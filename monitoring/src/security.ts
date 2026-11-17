import { execFile } from "node:child_process";
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "./config.ts";
import { db, transaction } from "./db.ts";
import type { Check } from "./collect/checks.ts";
import type { Observer } from "./collect/nginx.ts";
import { minuteOf, nowSec } from "./time.ts";

/*--Attack protection. Every minute, from the requests nginx just logged:

  1. DETECT an attack: a flood far above normal traffic, vulnerability scanning, staff password guessing,
     or many requests refused by the rate limit.
  2. JUDGE whether real visitors are affected: a site check failing, real visitors getting server errors,
     pages getting very slow, or the CPU maxed out.
  3. PREVENT: block, for a while, addresses that do what no real visitor does (probing for .php/.env files,
     guessing staff passwords, hundreds of requests a minute). nginx refuses them (deploy/nginx-protection.conf).

  The rule for warnings: an attack that is blocked while visitors are fine is only recorded (Security page),
  never a warning. A warning and an alert come only when real visitors are affected.

  Privacy: addresses are kept in memory for 10 minutes; a blocked address is stored only while it is blocked,
  and the history keeps it masked (103.12.x.x).--*/

const WINDOW = 10 * 60;

/*--Thresholds. Real visitors never come near these; changing them changes what counts as an attack.--*/
export const RULES = {
  banProbes: 8, // requests for .php/.env/wp-login... in 10 minutes, from one address
  banLoginFails: 15, // failed staff sign-ins in 10 minutes, from one address
  banRequests: 1500, // page/API requests in 5 minutes from one address (5 a second, non-stop)
  banHours: 1, // first block; doubles each time the same address comes back, up to 24 hours
  floodPerMinute: 300, // site-wide page/API requests a minute that count as a flood...
  floodTimesNormal: 8, // ...and only when also this many times the busiest normal hour
  scanProbes: 30, // site-wide probes in 10 minutes
  guessLoginFails: 20, // site-wide failed sign-ins in 10 minutes
  limitedRequests: 100, // site-wide requests refused by the rate limit in 5 minutes
  // Visitors are affected when, in the last 5 minutes:
  visitorErrorRate: 0.1, // 10% of real visitors' requests fail with a server error (and at least 10 do)
  visitorSlowMs: 5000, // 95% of page loads take longer than this (and at least 10 pages were viewed)
  cpuPercent: 95, // the CPU is this busy on average
};

type MinuteStats = { requests: number; real: number; realErrors: number; views: number; latencies: number[]; probes: number; loginFails: number; limited: number };
type IpMinute = { requests: number; probes: number; loginFails: number };

const minutes = new Map<number, MinuteStats>();
const perIp = new Map<string, Map<number, IpMinute>>();

/*--Called for every log line as it is read (wired up by the collector)--*/
export const observe: Observer = (line, sec, flags) => {
  // Old lines (a backlog after a restart) are counted in the charts but never trigger blocks or alerts
  if (sec < nowSec() - WINDOW) return;
  const minute = minuteOf(sec);
  let m = minutes.get(minute);
  if (!m) minutes.set(minute, (m = { requests: 0, real: 0, realErrors: 0, views: 0, latencies: [], probes: 0, loginFails: 0, limited: 0 }));
  if (flags.kind !== "asset") {
    m.requests++;
    if (!flags.bot && !flags.probe) {
      m.real++;
      if (line.s >= 500) m.realErrors++;
    }
  }
  if (flags.pageView) {
    m.views++;
    if (m.latencies.length < 5000) m.latencies.push((Number(line.rt) || 0) * 1000);
  }
  if (flags.probe) m.probes++;
  if (flags.loginFail) m.loginFails++;
  if (line.s === 429) m.limited++;

  if (!line.ip || perIp.size > 50_000) return;
  let ip = perIp.get(line.ip);
  if (!ip) perIp.set(line.ip, (ip = new Map()));
  let im = ip.get(minute);
  if (!im) ip.set(minute, (im = { requests: 0, probes: 0, loginFails: 0 }));
  if (flags.kind !== "asset") im.requests++;
  if (flags.probe) im.probes++;
  if (flags.loginFail) im.loginFails++;
};

const sum = <T>(map: Map<number, T>, since: number, pick: (v: T) => number) => {
  let total = 0;
  for (const [minute, v] of map) if (minute >= since) total += pick(v);
  return total;
};

const forgetOld = (now: number) => {
  const cutoff = minuteOf(now) - WINDOW;
  for (const minute of minutes.keys()) if (minute < cutoff) minutes.delete(minute);
  for (const [ip, m] of perIp) {
    for (const minute of m.keys()) if (minute < cutoff) m.delete(minute);
    if (!m.size) perIp.delete(ip);
  }
};

/*--Addresses never blocked: this server, private networks, the site's own addresses, ALLOW_IPS--*/
const allowed = new Set<string>(config.ALLOW_IPS);
const privateRange = new net.BlockList();
privateRange.addSubnet("127.0.0.0", 8);
privateRange.addSubnet("10.0.0.0", 8);
privateRange.addSubnet("172.16.0.0", 12);
privateRange.addSubnet("192.168.0.0", 16);
privateRange.addSubnet("169.254.0.0", 16);
privateRange.addSubnet("::1", 128, "ipv6");
privateRange.addSubnet("fc00::", 7, "ipv6");
privateRange.addSubnet("fe80::", 10, "ipv6");
export const refreshAllowed = async () => {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) allowed.add(a.address);
  for (const url of [config.SITE_URL, config.ADMIN_URL]) {
    try {
      for (const ip of await dns.resolve4(new URL(url).hostname)) allowed.add(ip);
    } catch {
      // offline or a local address
    }
  }
};
export const isAllowed = (ip: string) => {
  if (allowed.has(ip)) return true;
  const family = net.isIPv4(ip) ? "ipv4" : net.isIPv6(ip) ? "ipv6" : null;
  return !family || privateRange.check(ip, family);
};

export const maskIp = (ip: string) => (net.isIPv4(ip) ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip.split(":").slice(0, 3).join(":") + ":…");

/*--Blocked addresses: written to the file nginx reads, then nginx reloads (checked first, so a bad file never breaks the site)--*/
const run = promisify(execFile);
export type Reloader = () => Promise<void>;
let reloadNginx: Reloader = async () => {
  await run("sudo", ["-n", "/usr/sbin/nginx", "-t", "-q"], { timeout: 20_000 });
  await run("sudo", ["-n", "/usr/sbin/nginx", "-s", "reload"], { timeout: 20_000 });
};
export const setReloader = (fn: Reloader) => {
  reloadNginx = fn;
};

export const activeBans = (now = nowSec()) =>
  db.prepare(`SELECT ip, reason, since, until, hits, strikes FROM bans WHERE until > ? ORDER BY since DESC`).all(now) as {
    ip: string; reason: string; since: number; until: number; hits: number; strikes: number;
  }[];

let lastWritten: string | undefined;
export const writeBlocklist = async (now = nowSec()) => {
  const content = activeBans(now).map((b) => `${b.ip} ${b.ip};`).join("\n") + "\n";
  if (content === lastWritten && fs.existsSync(config.BLOCKLIST_FILE)) return false;
  const previous = fs.existsSync(config.BLOCKLIST_FILE) ? fs.readFileSync(config.BLOCKLIST_FILE, "utf8") : "\n";
  fs.mkdirSync(path.dirname(config.BLOCKLIST_FILE), { recursive: true });
  const temp = `${config.BLOCKLIST_FILE}.tmp`;
  fs.writeFileSync(temp, `# Written by BSREA monitoring: addresses blocked for attacking. Do not edit; use the dashboard.\n${content}`, { mode: 0o644 });
  fs.renameSync(temp, config.BLOCKLIST_FILE);
  try {
    await reloadNginx();
    lastWritten = content;
    return true;
  } catch (error) {
    // Put the old list back so the next nginx reload (certbot, a deploy) still works
    fs.writeFileSync(config.BLOCKLIST_FILE, previous);
    throw error;
  }
};

const ban = (ip: string, reason: string, now: number) => {
  const before = db.prepare(`SELECT strikes FROM bans WHERE ip = ?`).get(ip) as { strikes: number } | undefined;
  const strikes = (before?.strikes ?? 0) + 1;
  const until = now + Math.min(24, RULES.banHours * 2 ** (strikes - 1)) * 3600;
  db.prepare(`INSERT OR REPLACE INTO bans VALUES (?, ?, ?, ?, 0, ?)`).run(ip, reason, now, until, strikes);
  db.prepare(`INSERT INTO ban_log VALUES (?, ?, ?, ?, 'blocked')`).run(now, maskIp(ip), reason, until);
};

export const unban = async (ip: string, now = nowSec()) => {
  const row = db.prepare(`SELECT ip FROM bans WHERE ip = ? AND until > ?`).get(ip, now);
  if (!row) return false;
  db.prepare(`UPDATE bans SET until = ? WHERE ip = ?`).run(now, ip);
  db.prepare(`INSERT INTO ban_log VALUES (?, ?, 'Unblocked from the dashboard', ?, 'unblocked')`).run(now, maskIp(ip), now);
  await writeBlocklist(now);
  return true;
};

/*--Normal traffic: the busiest hour of the last 7 days, per minute (page and API requests)--*/
const normalPerMinute = (now: number) => {
  const rows = db.prepare(`SELECT ts, SUM(requests) AS n FROM traffic_hour WHERE ts >= ? AND ts < ? AND kind != 'asset' GROUP BY ts`).all(now - 7 * 86400, now - 3600) as { n: number }[];
  const values = rows.map((r) => r.n / 60).sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length * 0.95)] ?? values.at(-1)! : 0;
};

const p95 = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
};

export type Assessment = { attacks: string[]; impact: string[]; perMinute: number; newBans: number; checks: Check[] };

/*--The minute's verdict. Returns the two checks shown on the dashboard ("Real visitors", "Attack protection").--*/
export const assess = async (now = nowSec()): Promise<Assessment> => {
  forgetOld(now);
  const last5 = minuteOf(now) - 5 * 60;
  const last10 = minuteOf(now) - WINDOW;

  /*--Prevent: block addresses that clearly attack--*/
  let newBans = 0;
  if (config.AUTO_BLOCK) {
    const banned = new Set(activeBans(now).map((b) => b.ip));
    transaction(() => {
      for (const [ip, m] of perIp) {
        if (banned.has(ip) || isAllowed(ip)) continue;
        const probes = sum(m, last10, (v) => v.probes);
        const fails = sum(m, last10, (v) => v.loginFails);
        const requests = sum(m, last5, (v) => v.requests);
        const reason =
          probes >= RULES.banProbes ? `Looked for files that don't exist here (${probes} tries for things like .env or .php)`
          : fails >= RULES.banLoginFails ? `Guessed staff passwords (${fails} failed sign-ins)`
          : requests >= RULES.banRequests ? `Flooded the site (${requests} requests in 5 minutes)`
          : null;
        if (reason) {
          ban(ip, reason, now);
          newBans++;
        }
      }
    });
    try {
      await writeBlocklist(now);
    } catch (error) {
      console.error("[security] could not update the nginx block list:", error instanceof Error ? error.message : error);
    }
  }

  /*--Detect--*/
  const requests5 = sum(minutes, last5, (m) => m.requests);
  const perMinute = Math.round(requests5 / 5);
  const normal = normalPerMinute(now);
  const attacks: string[] = [];
  if (perMinute >= RULES.floodPerMinute && perMinute >= RULES.floodTimesNormal * Math.max(normal, 1))
    attacks.push(`flood of ${perMinute.toLocaleString("en-US")} requests a minute (normal busiest: ${Math.round(normal)})`);
  const probes = sum(minutes, last10, (m) => m.probes);
  if (probes >= RULES.scanProbes) attacks.push(`vulnerability scanning (${probes} probes)`);
  const fails = sum(minutes, last10, (m) => m.loginFails);
  if (fails >= RULES.guessLoginFails) attacks.push(`staff password guessing (${fails} failed sign-ins)`);
  const limited = sum(minutes, last5, (m) => m.limited);
  if (limited >= RULES.limitedRequests) attacks.push(`${limited} requests refused for coming too fast`);
  if (newBans) attacks.push(`${newBans} attacking address${newBans > 1 ? "es" : ""} blocked`);

  /*--Judge the effect on real visitors--*/
  // What visitors experience, seen in the traffic itself
  const felt: string[] = [];
  const real = sum(minutes, last5, (m) => m.real);
  const realErrors = sum(minutes, last5, (m) => m.realErrors);
  if (realErrors >= 10 && realErrors / Math.max(1, real) >= RULES.visitorErrorRate)
    felt.push(`${Math.round((100 * realErrors) / real)}% of visitors' requests fail (${realErrors} of ${real})`);
  const latencies = [...minutes].filter(([minute]) => minute >= last5).flatMap(([, m]) => m.latencies);
  const slow = p95(latencies);
  if (latencies.length >= 10 && slow >= RULES.visitorSlowMs) felt.push(`pages take ${(slow / 1000).toFixed(1)} s or more to load`);
  const cpu = db.prepare(`SELECT AVG(cpu_sum) AS cpu, COUNT(*) AS n FROM system_min WHERE ts >= ?`).get(last5) as { cpu: number | null; n: number };
  if (cpu.n >= 3 && (cpu.cpu ?? 0) >= RULES.cpuPercent) felt.push(`the server's processor is ${Math.round(cpu.cpu!)}% busy`);
  // ...plus a site that doesn't answer at all (its own check already alerts for that, so it only counts towards the attack verdict)
  const down = (db.prepare(`SELECT label FROM check_state WHERE name IN ('site', 'admin', 'api') AND ok = 0`).all() as { label: string }[]).map((d) => `${d.label} is not working`);
  const impact = [...down, ...felt];

  // Refused requests are added up one minute at a time (the 5-minute total would count each minute five times)
  recordEpisode(attacks, impact, perMinute, sum(minutes, minuteOf(now) - 60, (m) => m.limited), now);

  const bans = activeBans(now).length;
  const blockedNote = bans ? ` ${bans} address${bans > 1 ? "es" : ""} blocked right now.` : "";
  const visitors: Check = felt.length
    ? { name: "visitors", label: "Real visitors", ok: false, detail: `Visitors are affected: ${felt.join("; ")}`, hint: attacks.length ? "An attack is the cause: see the Security page" : "pm2 status and pm2 logs bsrea-site / bsrea-api" }
    : { name: "visitors", label: "Real visitors", ok: true, detail: real ? `Visitors are being served normally (${real} requests in 5 minutes)` : "No visitors in the last 5 minutes" };
  const security: Check = !attacks.length
    ? { name: "security", label: "Attack protection", ok: true, detail: `No attack right now.${blockedNote}` }
    : !impact.length
      ? { name: "security", label: "Attack protection", ok: true, detail: `Attack blocked: ${attacks.join("; ")}. Visitors are not affected.` }
      : {
          name: "security", label: "Attack protection", ok: false,
          detail: `Under attack (${attacks.join("; ")}) and visitors are affected`,
          hint: "Turn on Cloudflare's free 'Under Attack' mode (see README, Security), and check the blocked addresses on the Security page",
        };
  return { attacks, impact, perMinute, newBans, checks: [visitors, security] };
};

/*--Attack episodes for the Security page: one row per attack, from first to last sign, ended after 10 quiet minutes--*/
const recordEpisode = (attacks: string[], impact: string[], perMinute: number, limited: number, now: number) => {
  const open = db.prepare(`SELECT * FROM security_events WHERE end IS NULL ORDER BY start DESC LIMIT 1`).get() as
    | { id: number; kinds: string; peak_per_min: number; blocked: number; affected: number; detail: string; impact: string | null }
    | undefined;
  if (attacks.length) {
    const kinds = attacks.map((a) => a.split(" (")[0].replace(/^\d+ /, "").replace(/^flood of .*/, "flood")).join(", ");
    if (!open) {
      db.prepare(`INSERT INTO security_events (start, kinds, detail, peak_per_min, blocked, affected, impact, end) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`)
        .run(now, kinds, attacks.join("; "), perMinute, limited, impact.length ? 1 : 0, impact.join("; ") || null);
    } else {
      const merged = [...new Set([...open.kinds.split(", "), ...kinds.split(", ")])].join(", ");
      db.prepare(`UPDATE security_events SET kinds = ?, detail = ?, peak_per_min = MAX(peak_per_min, ?), blocked = blocked + ?, affected = MAX(affected, ?), impact = COALESCE(?, impact) WHERE id = ?`)
        .run(merged, attacks.join("; "), perMinute, limited, impact.length ? 1 : 0, impact.join("; ") || null, open.id);
    }
    lastAttack = now;
  } else if (open && now - Math.max(lastAttack, 0) >= 10 * 60) {
    db.prepare(`UPDATE security_events SET end = ? WHERE id = ?`).run(lastAttack || now, open.id);
  }
};
let lastAttack = 0;

/*--For tests: start from a clean slate--*/
export const resetSecurity = () => {
  minutes.clear();
  perIp.clear();
  lastWritten = undefined;
  lastAttack = 0;
};
