import dotenv from "dotenv";
import path from "path";

// Read settings from .env.local first, then .env
dotenv.config({ path: [".env.local", ".env"], quiet: true });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

/*--A 32-byte secret given as 64 hex characters (make one with: npm run keygen)--*/
const secretKey = (name: string): Buffer => {
  const value = process.env[name];
  if (value && /^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  // Automated tests only: a fixed, clearly-not-secret key. Everywhere else the real key is required,
  // so a server started without NODE_ENV=production can never fall back to a publicly known key.
  if (NODE_ENV === "test" && !value) return Buffer.alloc(32, name.length);
  throw new Error(`${name} must be set to 64 hex characters (32 bytes). Run "npm run keygen" to make one.`);
};

const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "storage");

const envConfig = {
  NODE_ENV,
  isProduction,
  PORT: Number(process.env.PORT) || 3002,
  // Network address to listen on. On a server behind nginx set HOST=127.0.0.1 so only nginx can reach the API.
  HOST: process.env.HOST || undefined,
  // Comma-separated list of websites allowed to call the API
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:3004,http://localhost:3001").split(",").map((origin) => origin.trim()),
  // Folder for saved files (database, uploaded documents, contact messages). Not committed to git.
  STORAGE_DIR,
  // SQLite database file (":memory:" in tests)
  DATABASE_FILE: process.env.DATABASE_FILE || path.join(STORAGE_DIR, "bsrea.db"),
  // Encrypts sensitive fields (NID/passport numbers) and uploaded documents (AES-256-GCM)
  ENCRYPTION_KEY: secretKey("ENCRYPTION_KEY"),
  // Makes the lookup fingerprints used to find duplicates without storing the plain value (HMAC-SHA256)
  BLIND_INDEX_KEY: secretKey("BLIND_INDEX_KEY"),
  // Public website address, used in the QR codes on certificates
  PUBLIC_SITE_URL: (process.env.PUBLIC_SITE_URL || "http://localhost:3004").replace(/\/$/, ""),
  // Staff sessions end after this many hours without activity
  SESSION_HOURS: Number(process.env.SESSION_HOURS) || 8,
  // Staff must use an authenticator app to log in. On by default in production; set to 0 to turn off.
  REQUIRE_TWO_FACTOR: process.env.REQUIRE_TWO_FACTOR ? process.env.REQUIRE_TWO_FACTOR === "1" : isProduction,
  // Where "npm run backup" writes backups. Put it on a different disk, or copy it off the server.
  BACKUP_DIR: path.resolve(process.env.BACKUP_DIR || "backups"),
  // How many backups to keep
  BACKUP_KEEP: Number(process.env.BACKUP_KEEP) || 14,
  // Documents of rejected applications are deleted this many days after the decision ("npm run retention")
  RETENTION_DAYS: Number(process.env.RETENTION_DAYS) || 180,
  // ClamAV virus scanner (clamd). When CLAMAV_HOST is set every upload is scanned, and uploads are refused if the scanner is down.
  CLAMAV_HOST: process.env.CLAMAV_HOST || "",
  CLAMAV_PORT: Number(process.env.CLAMAV_PORT) || 3310,
  // The application form asks for the bank receipt of the membership fee. Set to 0 to make it optional while testing
  // the process without paying; staff then see a warning on every application that has no receipt.
  PAYMENT_RECEIPT_REQUIRED: process.env.PAYMENT_RECEIPT_REQUIRED !== "0",
};

/*--Settings a production server behind nginx must set itself. The defaults are made for a laptop, and on a server
  they fail quietly: without TRUST_PROXY every visitor looks like 127.0.0.1, so the whole internet shares one rate
  limit and one login lockout. server.ts refuses to start while anything is listed here.--*/
export const productionProblems = (env: NodeJS.ProcessEnv = process.env): string[] => {
  if ((env.NODE_ENV || "development") !== "production") return [];
  const problems: string[] = [];
  if (!(Number(env.TRUST_PROXY) >= 1)) problems.push("TRUST_PROXY must be 1 (the API runs behind nginx)");
  const origins = (env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!origins.length) problems.push("CORS_ORIGINS must list the websites, e.g. https://bsreabd.org,https://admin.bsreabd.org");
  else if (origins.some((o) => !o.startsWith("https://")))
    problems.push("CORS_ORIGINS must contain https:// addresses only");
  if (!env.PUBLIC_SITE_URL?.startsWith("https://"))
    problems.push("PUBLIC_SITE_URL must be the public website's https:// address (it goes in certificate QR codes)");
  return problems;
};

export default envConfig;
