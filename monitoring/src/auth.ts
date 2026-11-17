import crypto from "node:crypto";
import { config } from "./config.ts";
import { db, getMeta, setMeta } from "./db.ts";
import { nowSec } from "./time.ts";

/*--Dashboard login: one password for the people who look after the website (set with "npm run set-password").
  The password is stored as a scrypt hash; sessions are random tokens, stored hashed, ending after SESSION_HOURS.--*/

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
};

export const verifyPassword = (password: string, stored: string | undefined) => {
  if (!stored) return false;
  const [kind, n, salt, hash] = stored.split("$");
  if (kind !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(actual, expected);
};

export const hasPassword = () => Boolean(getMeta("password"));
export const setPassword = (password: string) => {
  setMeta("password", hashPassword(password));
  // A new password logs everyone out
  db.exec(`DELETE FROM sessions`);
};
export const checkPassword = (password: string) => verifyPassword(password, getMeta("password"));

const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const createSession = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = nowSec();
  db.prepare(`INSERT INTO sessions VALUES (?, ?, ?)`).run(tokenHash(token), now, now + config.SESSION_HOURS * 3600);
  return token;
};

export const validSession = (token: string | undefined) => {
  if (!token) return false;
  const row = db.prepare(`SELECT expires FROM sessions WHERE token_hash = ?`).get(tokenHash(token)) as { expires: number } | undefined;
  return Boolean(row && row.expires > nowSec());
};

export const endSession = (token: string | undefined) => {
  if (token) db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash(token));
};

/*--Slow down password guessing: after 5 wrong passwords from one address, wait 15 minutes--*/
const failures = new Map<string, { count: number; until: number }>();
export const loginBlocked = (ip: string) => (failures.get(ip)?.until ?? 0) > Date.now();
export const loginFailed = (ip: string) => {
  const f = failures.get(ip) ?? { count: 0, until: 0 };
  f.count++;
  if (f.count >= 5) {
    f.until = Date.now() + 15 * 60_000;
    f.count = 0;
  }
  failures.set(ip, f);
  if (failures.size > 10_000) failures.clear();
};
export const loginSucceeded = (ip: string) => failures.delete(ip);
