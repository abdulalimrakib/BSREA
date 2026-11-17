import fs from "node:fs";
import path from "node:path";

/*--Settings, from monitoring/.env (see .env.example). Every setting has a default that works on the
  BSREA server laid out as in docs/deployment.md (/srv/bsrea), so .env only needs the alert address.--*/

export const ROOT = path.resolve(import.meta.dirname, "..");
const envFile = process.env.MONITOR_ENV_FILE ?? path.join(ROOT, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = (name: string, fallback = "") => process.env[name]?.trim() || fallback;
const num = (name: string, fallback: number) => Number(process.env[name]) || fallback;
const fromRoot = (value: string) => path.resolve(ROOT, value);

export const config = {
  PORT: num("PORT", 3005),
  // nginx is the only way in from the internet; the dashboard itself listens on this machine only
  HOST: env("HOST", "127.0.0.1"),
  DATA_FILE: env("DATA_FILE") === ":memory:" ? ":memory:" : fromRoot(env("DATA_FILE", "data/monitor.db")),
  // Days are counted in this time zone (charts are shown in the viewer's own time)
  TIMEZONE: env("TIMEZONE", "Asia/Dhaka"),

  /*--What is watched--*/
  // Addresses checked every 5 minutes (the API is checked directly, on this machine)
  SITE_URL: env("SITE_URL", "http://127.0.0.1:3004"),
  ADMIN_URL: env("ADMIN_URL", "http://127.0.0.1:3001"),
  API_HEALTH_URL: env("API_HEALTH_URL", "http://127.0.0.1:3002/health"),
  // nginx log in the bsrea_json format (deploy/nginx-logging.conf)
  NGINX_LOG: env("NGINX_LOG", "/var/log/nginx/bsrea.access.log"),
  // The backend's database, read-only, for membership counts and data size
  BACKEND_DB: fromRoot(env("BACKEND_DB", "../backend/storage/bsrea.db")),
  BACKEND_STORAGE: fromRoot(env("BACKEND_STORAGE", "../backend/storage")),
  // Where the backend's nightly backups go (BACKUP_DIR in backend/.env)
  BACKUP_DIR: fromRoot(env("BACKUP_DIR", "/var/backups/bsrea")),
  // Disk to watch: the one the apps and data live on
  DISK_PATH: fromRoot(env("DISK_PATH", "..")),

  /*--Alerts--*/
  // An ntfy.sh topic URL (free phone app), or a Discord or Slack webhook. Empty: alerts only on the dashboard.
  ALERT_WEBHOOK_URL: env("ALERT_WEBHOOK_URL"),
  ALERT_DISK_PERCENT: num("ALERT_DISK_PERCENT", 85),
  ALERT_MEMORY_PERCENT: num("ALERT_MEMORY_PERCENT", 90),
  // A still-broken problem is reported again after this many hours
  ALERT_REMIND_HOURS: num("ALERT_REMIND_HOURS", 6),

  /*--Attack protection (see README, "Security")--*/
  // Block addresses that clearly attack (probing for .php/.env files, guessing passwords, flooding). 0 = only watch.
  AUTO_BLOCK: env("AUTO_BLOCK", "1") === "1",
  // nginx reads blocked addresses from here (deploy/nginx-protection.conf includes it)
  BLOCKLIST_FILE: fromRoot(env("BLOCKLIST_FILE", "data/blocklist.map")),
  // Addresses never blocked, comma-separated (for example the office). This server and private networks never are.
  ALLOW_IPS: env("ALLOW_IPS").split(",").map((ip) => ip.trim()).filter(Boolean),

  /*--Login--*/
  SESSION_HOURS: num("SESSION_HOURS", 12),
  // Send the login cookie over HTTPS only. On by default; 0 only for trying it out on this computer.
  COOKIE_SECURE: env("COOKIE_SECURE", "1") === "1",

  /*--How long the detail is kept (daily and hourly totals are kept for good)--*/
  KEEP_MINUTES_DAYS: num("KEEP_MINUTES_DAYS", 35),
};

export type Config = typeof config;
