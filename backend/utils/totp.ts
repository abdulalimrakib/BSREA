import crypto from "crypto";

/*--Authenticator-app codes (TOTP, RFC 6238): 6 digits, a new one every 30 seconds.
  Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password and others.--*/

const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (data: Buffer) => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

const base32Decode = (text: string) => {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Bad base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

/*--A new random secret (160 bits), as base32 text for the authenticator app--*/
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const currentStep = (time = Date.now()) =>
  Math.floor(time / 1000 / STEP_SECONDS);

/*--The 6-digit code for one 30-second step--*/
export const totpCode = (secret: string, step: number) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 15;
  const number = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(number).padStart(6, "0");
};

/*--Check a code, allowing one step either way for clock drift. Gives back the step it matched
  (store it, and refuse codes from that step or earlier, so a code can't be used twice) or null.--*/
export const verifyTotp = (
  secret: string,
  code: string,
  lastUsedStep: number | null,
  time = Date.now(),
): number | null => {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = currentStep(time);
  for (const step of [now - 1, now, now + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (
      crypto.timingSafeEqual(
        Buffer.from(totpCode(secret, step)),
        Buffer.from(clean),
      )
    )
      return step;
  }
  return null;
};

/*--The link the QR code holds; scanning it adds the account to the app--*/
export const otpauthUrl = (
  secret: string,
  account: string,
  issuer = "BSREA Admin",
) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
