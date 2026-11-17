import crypto from "node:crypto";
import fs from "node:fs";
import { BUCKET_LIMITS_MS, db, getMeta, setMeta, transaction } from "../db.ts";
import { dayKey, hourOf, minuteOf } from "../time.ts";
import { config } from "../config.ts";

/*--Website and API traffic from the nginx access log (format bsrea_json, deploy/nginx-logging.conf).

  nginx sees every request to every BSREA site, so the running apps need no changes. Every minute the
  new lines are read (following the log through logrotate) and added up. IP addresses are only used,
  hashed with a key that changes daily, to count visitors; they are never stored.--*/

export type LogLine = {
  t: string; // time, ISO 8601
  h: string; // site (host)
  ip: string;
  m: string; // method
  u: string; // address requested, with query
  s: number; // status
  b: number; // bytes sent
  rt: number; // seconds taken
  ua: string; // browser (user agent)
  rsc?: string; // "1": a Next.js in-app page change
  pf?: string; // "1": a Next.js prefetch, not a visit
};

export type Kind = "page" | "api" | "asset";

const BOT = /bot|crawl|spider|slurp|curl|wget|python|java\/|go-http|axios|node-fetch|okhttp|monitor|uptime|pingdom|headless|lighthouse|preview|facebookexternalhit|whatsapp|telegram|scan|^-?$/i;
const ASSET = /^\/_next\/|^\/uploads\/|\.[a-z0-9]{2,5}$/i;

export const isBot = (ua: string) => BOT.test(ua ?? "");
export const pathOf = (url: string) => (url.split("?")[0] || "/").replace(/(.)\/$/, "$1");
export const kindOf = (url: string): Kind => {
  const p = pathOf(url);
  if (p.startsWith("/api/")) return "api";
  return ASSET.test(p) ? "asset" : "page";
};

/*--A real person opening a page: a full load or an in-app page change, not a prefetch, bot or error--*/
export const isPageView = (line: LogLine) =>
  line.m === "GET" && line.s === 200 && kindOf(line.u) === "page" && line.pf !== "1" && !isBot(line.ua);

/*--API route as a pattern: IDs, numbers and references become ":id", so no personal data is stored
  and every application counts towards the same route--*/
export const routeOf = (url: string) =>
  pathOf(url)
    .split("/")
    .map((part) => /^\d+$/.test(part) || (/\d/.test(part) && part.length > 2) || /^[0-9a-f-]{16,}$/i.test(part) || part.length > 40 ? ":id" : part)
    .join("/");

/*--Requests for things that don't exist on a Next.js site: real visitors never ask for them; vulnerability scanners do--*/
const PROBE = /\.(php\d?|asp|aspx|jsp|cgi|env|ini|sql|bak|old|swp|git|ds_store|yml|yaml)(\/|$)|\/(\.env|\.git|\.aws|\.ssh|\.vscode|wp-admin|wp-login|wp-content|wp-includes|xmlrpc|phpmyadmin|pma|cgi-bin|vendor\/phpunit|actuator|boaform|HNAP1|owa|autodiscover|server-status|config\.json|\.well-known\/security\.txt\.bak)/i;
export const isProbe = (url: string) => PROBE.test(pathOf(url));

/*--A failed staff sign-in (wrong password or code, locked, or too many tries)--*/
export const isLoginFail = (line: LogLine) => line.m === "POST" && pathOf(line.u).startsWith("/api/v1/auth/") && [401, 423, 429].includes(line.s);

/*--Something that wants to see every request (the security module), set by the collector--*/
export type Observer = (line: LogLine, sec: number, flags: { kind: Kind; bot: boolean; probe: boolean; loginFail: boolean; pageView: boolean }) => void;
let observer: Observer | undefined;
export const setObserver = (fn: Observer | undefined) => {
  observer = fn;
};

const bucketOf = (ms: number) => {
  const i = BUCKET_LIMITS_MS.findIndex((limit) => ms <= limit);
  return i === -1 ? BUCKET_LIMITS_MS.length : i;
};

type Tally = { requests: number; views: number; bots: number; s4: number; s5: number; bytes: number; latSum: number; b: number[]; probes: number; loginFails: number; limited: number };
const emptyTally = (): Tally => ({ requests: 0, views: 0, bots: 0, s4: 0, s5: 0, bytes: 0, latSum: 0, b: [0, 0, 0, 0, 0, 0, 0], probes: 0, loginFails: 0, limited: 0 });

/*--Add up a batch of lines and save them. Additive, so batches can come in any order.--*/
export const ingest = (lines: LogLine[]) => {
  const traffic = new Map<string, Tally>(); // minute|host|kind
  const routes = new Map<string, Tally & { errors: number }>(); // day|host|method|route
  const pages = new Map<string, number>(); // day|host|path
  const visitors = new Set<string>(); // day|host|hash
  const salts = new Map<string, string>();

  for (const line of lines) {
    const ms = Date.parse(line.t);
    if (!Number.isFinite(ms) || !line.h) continue;
    const sec = Math.floor(ms / 1000);
    const day = dayKey(sec);
    const kind = kindOf(line.u);
    const host = line.h.toLowerCase().slice(0, 100);
    const latency = (Number(line.rt) || 0) * 1000;
    const key = `${minuteOf(sec)}|${host}|${kind}`;
    const t = traffic.get(key) ?? traffic.set(key, emptyTally()).get(key)!;
    t.requests++;
    t.bytes += Number(line.b) || 0;
    t.latSum += latency;
    t.b[bucketOf(latency)]++;
    if (line.s >= 500) t.s5++;
    else if (line.s >= 400) t.s4++;
    const bot = isBot(line.ua);
    if (bot) t.bots++;
    const probe = isProbe(line.u);
    const loginFail = isLoginFail(line);
    if (probe) t.probes++;
    if (loginFail) t.loginFails++;
    if (line.s === 429) t.limited++;
    const pageView = isPageView(line);
    observer?.(line, sec, { kind, bot, probe, loginFail, pageView });

    if (pageView) {
      t.views++;
      const page = `${day}|${host}|${pathOf(line.u).slice(0, 200)}`;
      pages.set(page, (pages.get(page) ?? 0) + 1);
      if (!salts.has(day)) salts.set(day, daySalt(day));
      const hash = crypto.createHmac("sha256", salts.get(day)!).update(`${line.ip}|${line.ua}`).digest("base64url").slice(0, 22);
      visitors.add(`${day}|${host}|${hash}`);
    }

    // Per-route detail for the API only (website pages are covered by pages_day)
    if (kind === "api") {
      const rkey = `${day}|${host}|${line.m}|${routeOf(line.u).slice(0, 120)}`;
      const r = routes.get(rkey) ?? routes.set(rkey, { ...emptyTally(), errors: 0 }).get(rkey)!;
      r.requests++;
      r.latSum += latency;
      r.b[bucketOf(latency)]++;
      if (line.s >= 500) r.errors++;
    }
  }

  transaction(() => {
    const addTraffic = (table: string) =>
      db.prepare(`
        INSERT INTO ${table} (ts, host, kind, requests, views, bots, s4, s5, bytes, lat_sum, b0, b1, b2, b3, b4, b5, b6, probes, login_fails, limited)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (ts, host, kind) DO UPDATE SET requests = requests + excluded.requests, views = views + excluded.views,
          bots = bots + excluded.bots, s4 = s4 + excluded.s4, s5 = s5 + excluded.s5, bytes = bytes + excluded.bytes,
          lat_sum = lat_sum + excluded.lat_sum, b0 = b0 + excluded.b0, b1 = b1 + excluded.b1, b2 = b2 + excluded.b2,
          b3 = b3 + excluded.b3, b4 = b4 + excluded.b4, b5 = b5 + excluded.b5, b6 = b6 + excluded.b6,
          probes = probes + excluded.probes, login_fails = login_fails + excluded.login_fails, limited = limited + excluded.limited`);
    const minute = addTraffic("traffic_min");
    const hour = addTraffic("traffic_hour");
    for (const [key, t] of traffic) {
      const [ts, host, kind] = key.split("|");
      const values = [host, kind, t.requests, t.views, t.bots, t.s4, t.s5, t.bytes, t.latSum, ...t.b, t.probes, t.loginFails, t.limited] as const;
      minute.run(Number(ts), ...values);
      hour.run(hourOf(Number(ts)), ...values);
    }

    const route = db.prepare(`
      INSERT INTO routes_day (day, host, method, route, requests, errors, lat_sum, b0, b1, b2, b3, b4, b5, b6)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (day, host, method, route) DO UPDATE SET requests = requests + excluded.requests, errors = errors + excluded.errors,
        lat_sum = lat_sum + excluded.lat_sum, b0 = b0 + excluded.b0, b1 = b1 + excluded.b1, b2 = b2 + excluded.b2,
        b3 = b3 + excluded.b3, b4 = b4 + excluded.b4, b5 = b5 + excluded.b5, b6 = b6 + excluded.b6`);
    for (const [key, r] of routes) {
      const [day, host, method, path] = key.split("|");
      route.run(day, host, method, path, r.requests, r.errors, r.latSum, ...r.b);
    }

    const page = db.prepare(`INSERT INTO pages_day VALUES (?, ?, ?, ?) ON CONFLICT (day, host, path) DO UPDATE SET views = views + excluded.views`);
    for (const [key, views] of pages) {
      const [day, host, path] = key.split("|");
      page.run(day, host, path, views);
    }

    const seen = db.prepare(`INSERT OR IGNORE INTO visitor_seen VALUES (?, ?, ?)`);
    const touched = new Set<string>();
    for (const key of visitors) {
      const [day, host, hash] = key.split("|");
      seen.run(day, host, hash);
      touched.add(`${day}|${host}`);
    }
    const count = db.prepare(`INSERT OR REPLACE INTO visitors_day SELECT day, host, COUNT(*) FROM visitor_seen WHERE day = ? AND host = ? GROUP BY day, host`);
    for (const key of touched) count.run(...(key.split("|") as [string, string]));
  });
};

/*--A secret per day, so a visitor hash can't be linked across days or turned back into an address--*/
const daySalt = (day: string) => {
  let secret = getMeta("visitor_secret");
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    setMeta("visitor_secret", secret);
  }
  return crypto.createHmac("sha256", secret).update(day).digest("hex");
};

export const parseLine = (text: string): LogLine | undefined => {
  if (!text.startsWith("{")) return undefined;
  try {
    return JSON.parse(text) as LogLine;
  } catch {
    return undefined; // a line cut off during log rotation
  }
};

/*--Read whole lines from `offset`, at most `max` bytes. Returns the lines and where to continue.--*/
const readFrom = (file: string, offset: number, max = 64 * 1024 * 1024) => {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size - offset, max);
    if (length <= 0) return { lines: [] as LogLine[], next: offset };
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, offset);
    const end = buffer.lastIndexOf(10); // the last complete line
    if (end === -1) return { lines: [], next: offset };
    const lines = buffer.subarray(0, end).toString("utf8").split("\n").map(parseLine).filter((l): l is LogLine => !!l);
    return { lines, next: offset + end + 1 };
  } finally {
    fs.closeSync(fd);
  }
};

/*--Read what nginx wrote since last time. Handles logrotate: the old file (now .1) is finished first.--*/
export const readNewLines = (file = config.NGINX_LOG) => {
  if (!fs.existsSync(file)) return { read: 0, problem: `nginx log not found at ${file}` };
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
    fs.accessSync(file, fs.constants.R_OK);
  } catch {
    return { read: 0, problem: `can't read ${file}: run monitoring/deploy/install.sh again (it gives this user read access)` };
  }
  const saved = JSON.parse(getMeta(`log:${file}`) ?? "null") as { ino: number; offset: number } | null;
  let read = 0;

  if (saved && saved.ino !== stat.ino) {
    // Rotated: finish the old file if it is still there as file.1
    const rotated = `${file}.1`;
    if (fs.existsSync(rotated) && fs.statSync(rotated).ino === saved.ino) {
      const { lines } = readFrom(rotated, saved.offset);
      ingest(lines);
      read += lines.length;
    }
  }
  let offset = saved && saved.ino === stat.ino ? saved.offset : 0;
  if (offset > stat.size) offset = 0; // the file was emptied (copytruncate)
  // Read in chunks so a big backlog never needs much memory
  for (;;) {
    const { lines, next } = readFrom(file, offset, 16 * 1024 * 1024);
    if (next === offset) break;
    ingest(lines);
    read += lines.length;
    offset = next;
  }
  setMeta(`log:${file}`, JSON.stringify({ ino: stat.ino, offset }));
  return { read, problem: undefined };
};
