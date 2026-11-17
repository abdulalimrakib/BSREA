import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { config } from "../config.ts";
import { db } from "../db.ts";
import { minuteOf, nowSec } from "../time.ts";
import { previousRestarts, readApps, saveApps } from "./apps.ts";
import { readDisk, readMemory } from "./system.ts";

/*--The checks run every 5 minutes. Each gives OK or a problem, in words a non-technical reader understands,
  plus a hint of what to do. Results are kept for the uptime charts.--*/

export type Check = { name: string; label: string; ok: boolean; detail: string; ms?: number; hint?: string };

const mb = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1048576)} MB`);

export const checkUrl = async (name: string, label: string, url: string): Promise<Check> => {
  const started = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "bsrea-monitor" } });
    await res.arrayBuffer();
    const ms = Math.round(performance.now() - started);
    if (res.status >= 500) return { name, label, ok: false, ms, detail: `Answers with an error (${res.status})`, hint: "The app behind nginx has crashed: see the Apps section, or run pm2 logs" };
    if (res.status >= 400 && res.status !== 401 && res.status !== 403) return { name, label, ok: false, ms, detail: `Answers ${res.status}` };
    if (ms > 5000) return { name, label, ok: false, ms, detail: `Very slow: ${(ms / 1000).toFixed(1)} s`, hint: "Check CPU and memory below" };
    return { name, label, ok: true, ms, detail: `Working, answered in ${ms} ms` };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "no answer within 10 s" : "not reachable";
    return { name, label, ok: false, ms: Math.round(performance.now() - started), detail: `Down: ${reason}`, hint: "pm2 status, then pm2 restart the app that is not online" };
  }
};

/*--The HTTPS certificate must be valid for 14 more days. Certbot renews at 30, so less means renewal broke.--*/
export const checkCertificate = (host: string): Promise<Check> =>
  new Promise((resolve) => {
    const name = `cert:${host}`;
    const label = `HTTPS certificate (${host})`;
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      resolve(
        days >= 14
          ? { name, label, ok: true, detail: `Valid for ${days} more days` }
          : { name, label, ok: false, detail: `Expires in ${days} days`, hint: "Automatic renewal failed: sudo certbot renew --dry-run" },
      );
    });
    socket.on("error", (error) => resolve({ name, label, ok: false, detail: `Can't check: ${error.message}` }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ name, label, ok: false, detail: "Can't check: no answer" });
    });
  });

export const checkDisk = (): Check => {
  const d = readDisk();
  const pct = Math.round((100 * d.used) / d.total);
  return pct < config.ALERT_DISK_PERCENT
    ? { name: "disk", label: "Disk space", ok: true, detail: `${pct}% used, ${mb(d.free)} free` }
    : { name: "disk", label: "Disk space", ok: false, detail: `${pct}% full, only ${mb(d.free)} free`, hint: "sudo du -sh /var/log /var/backups/bsrea /srv/bsrea/backend/storage" };
};

export const checkMemory = (): Check => {
  const m = readMemory();
  const pct = Math.round((100 * (m.total - m.available)) / m.total);
  const swapPct = m.swapTotal ? Math.round((100 * m.swapUsed) / m.swapTotal) : 0;
  const ok = pct < config.ALERT_MEMORY_PERCENT || swapPct < 50;
  return {
    name: "memory", label: "Memory", ok,
    detail: `${pct}% used, ${mb(m.available)} free${m.swapTotal ? `, swap ${swapPct}%` : ""}`,
    hint: ok ? undefined : "The server is running out of memory: see the scaling advice",
  };
};

/*--A backup folder made in the last 26 hours (the backend's nightly "npm run backup")--*/
export const checkBackup = (dir = config.BACKUP_DIR): Check => {
  const name = "backup";
  const label = "Nightly backup";
  const folders = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^bsrea-\d{8}-\d{6}$/.test(f) && fs.existsSync(path.join(dir, f, "manifest.json"))).sort()
    : [];
  const newest = folders.at(-1);
  if (!newest) return { name, label, ok: false, detail: "No backup found", hint: `Check the backup cron job and ${dir}` };
  const hours = Math.round((Date.now() - fs.statSync(path.join(dir, newest)).mtimeMs) / 3_600_000);
  return hours <= 26
    ? { name, label, ok: true, detail: `Last backup ${hours} hour${hours === 1 ? "" : "s"} ago (${folders.length} kept)` }
    : { name, label, ok: false, detail: `Last backup ${hours} hours ago`, hint: "tail /srv/bsrea/backend/storage/backup.log" };
};

/*--Server errors (5xx) seen by nginx in the last 15 minutes--*/
export const checkErrors = (now = nowSec()): Check => {
  const row = db.prepare(`SELECT COALESCE(SUM(requests), 0) AS total, COALESCE(SUM(s5), 0) AS errors FROM traffic_min WHERE ts >= ? AND kind != 'asset'`)
    .get(minuteOf(now) - 15 * 60) as { total: number; errors: number };
  const ok = row.errors < 5 || row.errors / row.total < 0.05;
  return {
    name: "errors", label: "Server errors", ok,
    detail: row.errors ? `${row.errors} of ${row.total} requests failed in the last 15 minutes` : "No failed requests in the last 15 minutes",
    hint: ok ? undefined : "pm2 logs bsrea-api (or bsrea-site)",
  };
};

/*--Each PM2 app online and not restarting by itself--*/
export const checkApps = async (now = nowSec()): Promise<Check[]> => {
  const apps = await readApps();
  if (!apps) return [];
  saveApps(apps, now);
  return apps.map((app) => {
    const before = previousRestarts(app.name, minuteOf(now));
    const restarted = before !== undefined && app.restarts > before ? app.restarts - before : 0;
    const name = `app:${app.name}`;
    const label = `App ${app.name}`;
    if (app.status !== "online") return { name, label, ok: false, detail: `Not running (${app.status})`, hint: `pm2 restart ${app.name}` };
    if (restarted) return { name, label, ok: false, detail: `Restarted ${restarted} time(s) in the last 5 minutes`, hint: `pm2 logs ${app.name} --lines 100: a crash or the memory limit` };
    return { name, label, ok: true, detail: `Running, ${mb(app.mem)} memory` };
  });
};

const httpsHosts = () => [...new Set([config.SITE_URL, config.ADMIN_URL].filter((u) => u.startsWith("https://")).map((u) => new URL(u).hostname))];

export const runChecks = async (): Promise<Check[]> => {
  const results = await Promise.all([
    checkUrl("site", "Public website", config.SITE_URL),
    checkUrl("admin", "Staff panel", config.ADMIN_URL),
    checkUrl("api", "API (membership, contact form)", config.API_HEALTH_URL),
    ...httpsHosts().map(checkCertificate),
    checkApps(),
  ]);
  // Server errors are judged every minute by the attack check ("Real visitors"), which leaves out bots
  return [...results.flat(), checkDisk(), checkMemory(), checkBackup()];
};

export const saveResults = (checks: Check[], at = nowSec()) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO check_result VALUES (?, ?, ?, ?)`);
  for (const c of checks) insert.run(minuteOf(at), c.name, c.ok ? 1 : 0, c.ms ?? null);
};
