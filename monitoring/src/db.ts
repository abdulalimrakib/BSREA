import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

/*--The monitoring database: one SQLite file (data/monitor.db), separate from the member database.
  It holds no personal data: no IP addresses (visitors are counted by a daily-changing hash that is
  deleted after 2 days), no names, and API routes as patterns ("/api/v1/verify/:id").

  Times are Unix seconds (UTC). Detail is kept per minute for KEEP_MINUTES_DAYS; every write also adds
  to an hourly row, which is kept for good, so long-range charts stay fast.--*/

const BUCKETS = ["b0", "b1", "b2", "b3", "b4", "b5", "b6"];
const bucketCols = BUCKETS.map((b) => `${b} INTEGER NOT NULL DEFAULT 0`).join(", ");

const trafficCols = `host TEXT NOT NULL, kind TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0,
  bots INTEGER NOT NULL DEFAULT 0, s4 INTEGER NOT NULL DEFAULT 0, s5 INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
  lat_sum REAL NOT NULL DEFAULT 0, ${bucketCols}`;

const systemCols = `n INTEGER NOT NULL DEFAULT 0, cpu_sum REAL, cpu_max REAL, load_sum REAL, load_max REAL, cpus INTEGER,
  mem_total INTEGER, mem_used_sum REAL, mem_used_max INTEGER, swap_total INTEGER, swap_used_max INTEGER,
  disk_total INTEGER, disk_used INTEGER, net_rx INTEGER NOT NULL DEFAULT 0, net_tx INTEGER NOT NULL DEFAULT 0`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- Requests seen by nginx, per minute / hour, per site and kind (page, api, asset)
  CREATE TABLE IF NOT EXISTS traffic_min (ts INTEGER NOT NULL, ${trafficCols}, PRIMARY KEY (ts, host, kind));
  CREATE TABLE IF NOT EXISTS traffic_hour (ts INTEGER NOT NULL, ${trafficCols}, PRIMARY KEY (ts, host, kind));

  -- Visitors: one row per visitor per day (a hash that can't be turned back into an address), then a daily count
  CREATE TABLE IF NOT EXISTS visitor_seen (day TEXT NOT NULL, host TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (day, host, hash));
  CREATE TABLE IF NOT EXISTS visitors_day (day TEXT NOT NULL, host TEXT NOT NULL, visitors INTEGER NOT NULL, PRIMARY KEY (day, host));
  CREATE TABLE IF NOT EXISTS pages_day (day TEXT NOT NULL, host TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY (day, host, path));
  CREATE TABLE IF NOT EXISTS routes_day (
    day TEXT NOT NULL, host TEXT NOT NULL, method TEXT NOT NULL, route TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, lat_sum REAL NOT NULL DEFAULT 0, ${bucketCols},
    PRIMARY KEY (day, host, method, route)
  );

  -- Server: one sample a minute (n = 1), added up per hour
  CREATE TABLE IF NOT EXISTS system_min (ts INTEGER PRIMARY KEY, ${systemCols});
  CREATE TABLE IF NOT EXISTS system_hour (ts INTEGER PRIMARY KEY, ${systemCols});

  -- PM2 apps, every 5 minutes
  CREATE TABLE IF NOT EXISTS apps (ts INTEGER NOT NULL, app TEXT NOT NULL, status TEXT, cpu REAL, mem INTEGER, restarts INTEGER,
    uptime INTEGER, PRIMARY KEY (ts, app));

  -- Checks: every result (for uptime), the latest state, and every alert sent
  CREATE TABLE IF NOT EXISTS check_result (ts INTEGER NOT NULL, name TEXT NOT NULL, ok INTEGER NOT NULL, ms INTEGER, PRIMARY KEY (ts, name));
  CREATE TABLE IF NOT EXISTS check_state (name TEXT PRIMARY KEY, label TEXT NOT NULL, ok INTEGER NOT NULL, detail TEXT, hint TEXT,
    since INTEGER NOT NULL, checked INTEGER NOT NULL, alerted INTEGER);
  CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, level TEXT NOT NULL, title TEXT NOT NULL,
    body TEXT NOT NULL, delivered INTEGER NOT NULL);

  -- Membership activity and data size, once an hour (counts only)
  CREATE TABLE IF NOT EXISTS business_day (day TEXT PRIMARY KEY, members INTEGER, pending INTEGER, applications INTEGER,
    decided INTEGER, db_bytes INTEGER, docs_bytes INTEGER, backup_bytes INTEGER);

  -- Dashboard logins
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created INTEGER NOT NULL, expires INTEGER NOT NULL);

  -- Security: addresses blocked right now (the IP is kept only while the block lasts), and attack episodes
  CREATE TABLE IF NOT EXISTS bans (ip TEXT PRIMARY KEY, reason TEXT NOT NULL, since INTEGER NOT NULL, until INTEGER NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0, strikes INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY, start INTEGER NOT NULL, end INTEGER, kinds TEXT NOT NULL,
    detail TEXT NOT NULL, peak_per_min INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, affected INTEGER NOT NULL DEFAULT 0,
    impact TEXT);
  CREATE TABLE IF NOT EXISTS ban_log (ts INTEGER NOT NULL, ip_masked TEXT NOT NULL, reason TEXT NOT NULL, until INTEGER NOT NULL, action TEXT NOT NULL);
`;

/*--Columns added after the first release: added in place, so existing data is kept--*/
const MIGRATIONS: [table: string, column: string, definition: string][] = [
  ["traffic_min", "probes", "INTEGER NOT NULL DEFAULT 0"], // requests for files real visitors never ask for (.php, .env...)
  ["traffic_min", "login_fails", "INTEGER NOT NULL DEFAULT 0"], // failed staff sign-ins
  ["traffic_min", "limited", "INTEGER NOT NULL DEFAULT 0"], // refused for asking too fast (429)
  ["traffic_hour", "probes", "INTEGER NOT NULL DEFAULT 0"],
  ["traffic_hour", "login_fails", "INTEGER NOT NULL DEFAULT 0"],
  ["traffic_hour", "limited", "INTEGER NOT NULL DEFAULT 0"],
];
const migrate = (db: DatabaseSync) => {
  for (const [table, column, definition] of MIGRATIONS) {
    const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const open = () => {
  if (config.DATA_FILE !== ":memory:") {
    fs.mkdirSync(path.dirname(config.DATA_FILE), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(config.DATA_FILE);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;`);
  db.exec(SCHEMA);
  migrate(db);
  if (config.DATA_FILE !== ":memory:") fs.chmodSync(config.DATA_FILE, 0o600);
  return db;
};

export const db = open();

export const BUCKET_LIMITS_MS = [50, 100, 250, 500, 1000, 2500]; // b6 = slower than 2.5 s
export const BUCKET_COLUMNS = BUCKETS;

export const getMeta = (key: string) => (db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value: string } | undefined)?.value;
export const setMeta = (key: string, value: string) => db.prepare(`INSERT OR REPLACE INTO meta VALUES (?, ?)`).run(key, value);

/*--Run several writes as one unit--*/
export const transaction = <T>(work: () => T): T => {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};
