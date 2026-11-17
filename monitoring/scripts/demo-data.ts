/*--Fill a SEPARATE demo database (data/demo.db) with 60 days of made-up but realistic numbers, to try the
  dashboard on a computer without a live server. It never touches data/monitor.db.

    npm run demo-data     then     npm run demo     and open http://127.0.0.1:3005 (password: demo-password-123)

  Website traffic goes through the real log reader (ingest), so it is counted exactly as on the server.--*/

import { config } from "../src/config.ts";

if (!config.DATA_FILE.endsWith("demo.db")) {
  console.error("Refusing: demo data only goes into a file named demo.db (use npm run demo-data)");
  process.exit(1);
}

const fs = await import("node:fs");
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(config.DATA_FILE + suffix, { force: true });

const { db, transaction } = await import("../src/db.ts");
const { ingest } = await import("../src/collect/nginx.ts");
const { saveSample } = await import("../src/collect/system.ts");
const { setPassword } = await import("../src/auth.ts");
const { prune } = await import("../src/collector.ts");
const { dayKey, minuteOf, nowSec } = await import("../src/time.ts");
type LogLine = import("../src/collect/nginx.ts").LogLine;

let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
const DAYS = 60;
const now = nowSec();
const start = minuteOf(now - DAYS * 86400);
const GB = 1024 ** 3;
const MB = 1024 ** 2;

// Busy in Bangladesh office hours, quiet at night; slowly growing; quieter on Fridays
const activity = (sec: number) => {
  const hour = (new Date(sec * 1000).getUTCHours() + 6) % 24;
  const day = new Date((sec + 21600) * 1000).getUTCDay();
  const daily = Math.exp(-((hour - 14) ** 2) / 18) + 0.08;
  return daily * (day === 5 ? 0.45 : 1) * (1 + (0.6 * (sec - start)) / (DAYS * 86400));
};

const PAGES = ["/", "/", "/", "/about", "/members", "/members", "/news", "/news/annual-general-meeting-2026", "/membership/apply", "/contact", "/gallery", "/verify", "/board", "/news/real-estate-fair-dhaka"];
const ADMIN_PAGES = ["/", "/applications", "/members", "/certificates", "/duplicates"];
const API = [
  ["GET", "/api/v1/verify/BSREA-2026-0412", 120],
  ["POST", "/api/v1/contact", 180],
  ["POST", "/api/v1/applications", 900],
  ["GET", "/api/v1/admin/summary", 60],
  ["GET", "/api/v1/admin/applications", 90],
  ["GET", "/api/v1/admin/applications/17", 70],
  ["POST", "/api/v1/auth/login", 350],
  ["GET", "/api/v1/admin/certificates/22/pdf", 1400],
] as const;
const BROWSERS = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131", "Mozilla/5.0 (Linux; Android 14) Chrome/131 Mobile", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1) Safari/604.1", "Mozilla/5.0 (Macintosh) Firefox/133"];
const BOTS = ["Googlebot/2.1", "bingbot/2.0", "AhrefsBot/7.0", "python-requests/2.32", "Mozilla/5.0 zgrab/0.x"];

const latency = (base: number) => Math.max(0.004, (base / 1000) * (0.4 + random() * random() * 3));

console.log("Website and API traffic...");
for (let dayStartSec = start; dayStartSec < now; dayStartSec += 86400) {
  const lines: LogLine[] = [];
  for (let minute = dayStartSec; minute < Math.min(now, dayStartSec + 86400); minute += 60) {
    const visits = activity(minute) * 1.1;
    let count = Math.floor(visits) + (random() < visits % 1 ? 1 : 0);
    // An outage 9 days ago: the site answered 502 for 25 minutes
    const outage = minute > now - 9 * 86400 && minute < now - 9 * 86400 + 25 * 60;
    while (count-- > 0) {
      const t = new Date((minute + Math.floor(random() * 60)) * 1000).toISOString();
      const ip = `103.${Math.floor(random() * 40)}.${Math.floor(random() * 250)}.${Math.floor(random() * 250)}`;
      const ua = pick(BROWSERS);
      const page = pick(PAGES);
      const s = outage ? 502 : 200;
      lines.push({ t, h: "bsreabd.org", ip, m: "GET", u: page, s, b: 28000, rt: latency(page === "/members" ? 380 : 160), ua });
      for (let a = 0; a < 6; a++) lines.push({ t, h: "bsreabd.org", ip, m: "GET", u: `/_next/static/chunks/${a}.js`, s: 200, b: 40000, rt: 0.002, ua });
      if (random() < 0.35) lines.push({ t, h: "bsreabd.org", ip, m: "GET", u: "/news?_rsc=1x", s: 200, b: 9000, rt: latency(90), ua, rsc: "1", pf: "1" });
      if (random() < 0.12) {
        const [m, u, ms] = pick([...API]);
        lines.push({ t, h: u.includes("admin") ? "admin.bsreabd.org" : "bsreabd.org", ip, m, u, s: outage ? 502 : random() < 0.004 ? 500 : 200, b: 1200, rt: latency(ms), ua });
      }
      if (random() < 0.06) lines.push({ t, h: "admin.bsreabd.org", ip: "103.4.5.6", m: "GET", u: pick(ADMIN_PAGES), s: 200, b: 22000, rt: latency(200), ua: BROWSERS[0] });
    }
    // A flood 3 days ago, stopped by the rate limit (429): visitors didn't notice
    if (minute > now - 3 * 86400 && minute < now - 3 * 86400 + 20 * 60)
      for (let f = 0; f < 250; f++) lines.push({ t: new Date((minute + (f % 60)) * 1000).toISOString(), h: "bsreabd.org", ip: "185.220.101.4", m: "GET", u: "/", s: f < 40 ? 200 : 429, b: 300, rt: 0.001, ua: "Mozilla/5.0" });
    // Now and then someone guesses staff passwords
    if (random() < 0.004) for (let g = 0; g < 6; g++) lines.push({ t: new Date(minute * 1000).toISOString(), h: "admin.bsreabd.org", ip: "91.92.1.7", m: "POST", u: "/api/v1/auth/login", s: 401, b: 80, rt: 0.3, ua: "python-requests/2.32" });
    if (random() < 0.5) lines.push({ t: new Date(minute * 1000).toISOString(), h: "bsreabd.org", ip: "45.1.2.3", m: "GET", u: pick(["/wp-login.php", "/.env", "/xmlrpc.php", "/news"]), s: random() < 0.7 ? 404 : 200, b: 500, rt: 0.01, ua: pick(BOTS) });
  }
  ingest(lines);
}

console.log("Server samples...");
transaction(() => {
  for (let minute = start; minute < now; minute += 60) {
    const a = activity(minute);
    const progress = (minute - start) / (DAYS * 86400);
    saveSample(
      {
        cpu: Math.min(100, 4 + a * 22 + random() * 8 + (random() < 0.002 ? 50 : 0)),
        load: 0.1 + a * 0.6 + random() * 0.2,
        cpus: 2,
        memTotal: 956 * MB,
        memUsed: (640 + progress * 120 + a * 60 + random() * 30) * MB,
        swapTotal: 2 * GB,
        swapUsed: (90 + progress * 60 + random() * 10) * MB,
        diskTotal: 45 * GB,
        diskUsed: (11.2 + progress * 2.4) * GB,
        rx: Math.floor(a * 9 * MB * (0.5 + random())),
        tx: Math.floor(a * 30 * MB * (0.5 + random())),
      },
      minute,
    );
  }
});

console.log("Apps, checks and alerts...");
transaction(() => {
  const insertApp = db.prepare(`INSERT OR REPLACE INTO apps VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insertCheck = db.prepare(`INSERT OR REPLACE INTO check_result VALUES (?, ?, ?, ?)`);
  const restarts: Record<string, number> = { "bsrea-api": 2, "bsrea-site": 2, "bsrea-admin": 2, "bsrea-monitor": 1 };
  const base: Record<string, number> = { "bsrea-api": 92, "bsrea-site": 168, "bsrea-admin": 118, "bsrea-monitor": 48 };
  for (let t = start - (start % 300); t < now; t += 300) {
    const outage = t > now - 9 * 86400 && t < now - 9 * 86400 + 25 * 60;
    // Weekly deploys reload everything; the site crashed once during the outage
    if ((t - start) % (7 * 86400) === 0) for (const app in restarts) restarts[app]++;
    if (t === now - 9 * 86400 - ((now - 9 * 86400) % 300) + 300) restarts["bsrea-site"] += 3;
    for (const app in base)
      insertApp.run(t, app, outage && app === "bsrea-site" ? "errored" : "online", random() * 6 * activity(t), Math.floor((base[app] + random() * 25 + activity(t) * 30) * MB), restarts[app], 3600);
    for (const name of ["site", "admin", "api"]) {
      const down = outage && name !== "admin";
      insertCheck.run(t, name, down ? 0 : 1, down ? 10000 : Math.floor(name === "api" ? 4 + random() * 8 : 60 + random() * 120 * activity(t)));
    }
  }
  const state = db.prepare(`INSERT OR REPLACE INTO check_state VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const since = now - 9 * 86400 + 25 * 60;
  state.run("site", "Public website", 1, "Working, answered in 142 ms", null, since, now, since);
  state.run("admin", "Staff panel", 1, "Working, answered in 96 ms", null, now - 40 * 86400, now, null);
  state.run("api", "API (membership, contact form)", 1, "Working, answered in 6 ms", null, since, now, since);
  state.run("cert:bsreabd.org", "HTTPS certificate (bsreabd.org)", 1, "Valid for 61 more days", null, now - 40 * 86400, now, null);
  for (const app of Object.keys(base)) state.run(`app:${app}`, `App ${app}`, 1, `Running, ${base[app] + 20} MB memory`, null, since, now, null);
  state.run("disk", "Disk space", 1, "30% used, 31.4 GB free", null, now - 40 * 86400, now, null);
  state.run("memory", "Memory", 1, "81% used, 182 MB free, swap 7%", null, now - 40 * 86400, now, null);
  state.run("backup", "Nightly backup", 0, "Last backup 31 hours ago", "tail /srv/bsrea/backend/storage/backup.log", now - 5 * 3600, now, now - 5 * 3600);
  state.run("visitors", "Real visitors", 1, "Visitors are being served normally (182 requests in 5 minutes)", null, since, now, null);
  state.run("security", "Attack protection", 1, "Attack blocked: vulnerability scanning (34 probes); 1 attacking address blocked. Visitors are not affected.", null, now - 600, now, null);

  const ban = db.prepare(`INSERT INTO bans VALUES (?, ?, ?, ?, 0, ?)`);
  ban.run("45.1.2.3", "Looked for files that don't exist here (34 tries for things like .env or .php)", now - 600, now + 3000, 1);
  ban.run("91.92.1.7", "Guessed staff passwords (17 failed sign-ins)", now - 5400, now + 9000, 2);
  const log = db.prepare(`INSERT INTO ban_log VALUES (?, ?, ?, ?, ?)`);
  log.run(now - 3 * 86400 + 120, "185.220.x.x", "Flooded the site (2,410 requests in 5 minutes)", now - 3 * 86400 + 3720, "blocked");
  log.run(now - 2 * 86400, "91.92.x.x", "Guessed staff passwords (16 failed sign-ins)", now - 2 * 86400 + 3600, "blocked");
  log.run(now - 5400, "91.92.x.x", "Guessed staff passwords (17 failed sign-ins)", now + 9000, "blocked");
  log.run(now - 600, "45.1.x.x", "Looked for files that don't exist here (34 tries for things like .env or .php)", now + 3000, "blocked");
  const episode = db.prepare(`INSERT INTO security_events (start, end, kinds, detail, peak_per_min, blocked, affected, impact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  episode.run(now - 3 * 86400, now - 3 * 86400 + 20 * 60, "flood, requests refused for coming too fast, attacking address blocked", "flood of 262 requests a minute", 262, 4200, 0, null);
  episode.run(now - 2 * 86400, now - 2 * 86400 + 600, "staff password guessing, attacking address blocked", "staff password guessing (21 failed sign-ins)", 14, 0, 0, null);
  episode.run(now - 9 * 86400, now - 9 * 86400 + 25 * 60, "flood", "flood of 1,840 requests a minute", 1840, 310, 1, "Public website is not working; 64% of visitors' requests fail (212 of 331)");
  episode.run(now - 600, null, "vulnerability scanning, attacking address blocked", "vulnerability scanning (34 probes)", 22, 0, 0, null);

  const alert = db.prepare(`INSERT INTO alerts (ts, level, title, body, delivered) VALUES (?, ?, ?, ?, ?)`);
  const t0 = now - 9 * 86400;
  alert.run(t0 + 300, "problem", "BSREA: 3 problems", "PROBLEM: Public website. Answers with an error (502)\n  What to do: The app behind nginx has crashed: see the Apps section, or run pm2 logs\nPROBLEM: API (membership, contact form). Down: not reachable\nPROBLEM: App bsrea-site. Restarted 3 time(s) in the last 5 minutes", 1);
  alert.run(t0 + 25 * 60, "fixed", "BSREA: back to normal", "FIXED: Public website. Working, answered in 151 ms\nFIXED: API (membership, contact form). Working, answered in 5 ms\nFIXED: App bsrea-site. Running, 182 MB memory", 1);
  alert.run(now - 5 * 3600, "problem", "BSREA: 1 problem", "PROBLEM: Nightly backup. Last backup 31 hours ago\n  What to do: tail /srv/bsrea/backend/storage/backup.log", 1);

  const business = db.prepare(`INSERT OR REPLACE INTO business_day VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let d = 0; d <= DAYS; d++) {
    const t = start + d * 86400;
    business.run(dayKey(t), 412 + Math.floor(d * 0.7), 3 + (d % 5), 1 + (d % 3), d % 2, Math.floor((14 + d * 0.15) * MB), Math.floor((180 + d * 6.5) * MB), Math.floor((900 + d * 10) * MB));
  }
});

prune(now);
setPassword("demo-password-123");
db.exec("VACUUM");
console.log(`Demo data written to ${config.DATA_FILE}. Start it with: npm run demo   (password: demo-password-123)`);
