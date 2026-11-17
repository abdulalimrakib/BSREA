import crypto from "crypto";
import envConfig from "../config/env.config";

/*--Passwords: scrypt with a random salt. Stored as "scrypt$N$r$p$salt$hash".--*/
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
};

export const verifyPassword = (password: string, stored: string) => {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected);
};

// Used when the email is unknown, so a failed login takes the same time either way
export const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));

/*--Password rules for staff accounts--*/
export const passwordProblem = (password: string): string | null => {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 200) return "Password is too long";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain upper-case and lower-case letters and a number";
  }
  return null;
};

/*--Random tokens (sessions, certificate verification codes)--*/
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export const sha256 = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");

/*--Encryption for sensitive data at rest: AES-256-GCM. Output = iv(12) | tag(16) | ciphertext.--*/
export const encryptBuffer = (plain: Buffer): Buffer => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", envConfig.ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
};

export const decryptBuffer = (data: Buffer): Buffer => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", envConfig.ENCRYPTION_KEY, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
};

export const encryptText = (text: string) => encryptBuffer(Buffer.from(text, "utf8")).toString("base64");
export const decryptText = (data: string) => decryptBuffer(Buffer.from(data, "base64")).toString("utf8");

/*--Blind index: a keyed fingerprint of a normalised value.
  Two records with the same NID get the same fingerprint, so duplicates can be found
  without keeping the NID itself in readable form.--*/
export const blindIndex = (normalisedValue: string) =>
  crypto.createHmac("sha256", envConfig.BLIND_INDEX_KEY).update(normalisedValue).digest("hex");

/*--Show only the last characters: "1234567890" -> "******7890"--*/
export const mask = (value: string, visible = 4) => (value.length <= visible ? "*".repeat(value.length) : "*".repeat(value.length - visible) + value.slice(-visible));
