import { Request, Response } from "express";
import { z } from "zod";
import { db, now } from "../db/database";
import QRCode from "qrcode";
import envConfig from "../config/env.config";
import { endSession, startSession, type StaffRole } from "../middleware/auth";
import { audit } from "../services/audit";
import {
  decryptText,
  DUMMY_PASSWORD_HASH,
  encryptText,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "../utils/security";
import { newTotpSecret, otpauthUrl, verifyTotp } from "../utils/totp";
import { sendResponse } from "../utils/response";

/*--Staff login / logout, and two-factor login set-up--*/

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(150),
  password: z.string().max(200),
  code: z.string().trim().max(10).optional(),
});

type StaffRow = {
  id: number;
  email: string;
  name: string;
  role: StaffRole;
  password_hash: string;
  is_active: number;
  totp_secret_enc: string | null;
  totp_enabled: number;
  totp_last_step: number | null;
};

/*--Wrong passwords and codes are counted per account per IP address. Someone guessing from their own
  address only locks themselves out; the real staff member can still log in from theirs.
  (The login rate limit also caps every IP at 10 tries per 15 minutes, whatever account they try.)--*/
const failureKey = (req: Request) => req.ip ?? "unknown";

const lockedUntil = (userId: number, ip: string) => {
  const row = db
    .prepare(
      `SELECT locked_until FROM login_failures WHERE user_id = ? AND ip = ?`,
    )
    .get(userId, ip) as { locked_until: string | null } | undefined;
  return row?.locked_until && new Date(row.locked_until) > new Date()
    ? row.locked_until
    : null;
};

const recordFailure = (userId: number, ip: string) => {
  const row = db
    .prepare(`SELECT failures FROM login_failures WHERE user_id = ? AND ip = ?`)
    .get(userId, ip) as { failures: number } | undefined;
  const failures = (row?.failures ?? 0) + 1;
  const lock =
    failures >= MAX_FAILED
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : null;
  db.prepare(
    `INSERT INTO login_failures (user_id, ip, failures, locked_until, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, ip) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
  ).run(userId, ip, lock ? 0 : failures, lock, now());
  return lock !== null;
};

const clearFailures = (userId: number, ip: string) =>
  db
    .prepare(`DELETE FROM login_failures WHERE user_id = ? AND ip = ?`)
    .run(userId, ip);

/*--POST /api/v1/auth/login--*/
export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, "Email and password are required");
  const { email, password, code } = parsed.data;
  const ip = failureKey(req);

  const user = db
    .prepare(`SELECT * FROM staff_users WHERE email = ?`)
    .get(email) as StaffRow | undefined;

  // Always check a password, even for unknown emails, so timing doesn't reveal which emails exist
  const passwordOk = verifyPassword(
    password,
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );
  const fail = (message = "Wrong email or password") =>
    sendResponse(res, 401, message);

  if (!user || !user.is_active) {
    // Log the attempted email only if it looks like one: people sometimes type their password in the email box
    audit(req, "login.failed", undefined, {
      email: /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(email)
        ? email
        : "(not an email address)",
    });
    return fail();
  }
  if (lockedUntil(user.id, ip)) {
    audit(req, "login.locked", { type: "staff", id: user.id });
    return sendResponse(
      res,
      423,
      `Too many wrong tries. Try again after ${LOCK_MINUTES} minutes.`,
    );
  }
  if (!passwordOk) {
    const locked = recordFailure(user.id, ip);
    audit(req, locked ? "login.locked_now" : "login.failed", {
      type: "staff",
      id: user.id,
    });
    return fail();
  }

  // Two-factor login: the password was right, now the 6-digit code from the authenticator app is needed
  if (user.totp_enabled && user.totp_secret_enc) {
    if (!code)
      return sendResponse(
        res,
        401,
        "Enter the 6-digit code from your authenticator app",
        { twoFactorRequired: true },
      );
    const step = verifyTotp(
      decryptText(user.totp_secret_enc),
      code,
      user.totp_last_step,
    );
    if (step === null) {
      const locked = recordFailure(user.id, ip);
      audit(req, locked ? "login.locked_now" : "login.wrong_code", {
        type: "staff",
        id: user.id,
      });
      return sendResponse(res, 401, "Wrong or expired code", {
        twoFactorRequired: true,
      });
    }
    db.prepare(`UPDATE staff_users SET totp_last_step = ? WHERE id = ?`).run(
      step,
      user.id,
    );
  }

  clearFailures(user.id, ip);
  db.prepare(`UPDATE staff_users SET last_login_at = ? WHERE id = ?`).run(
    now(),
    user.id,
  );
  startSession(req, res, user.id);
  req.staff = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    twoFactor: user.totp_enabled === 1,
  };
  audit(req, "login.success", { type: "staff", id: user.id });
  return sendResponse(res, 200, "Logged in", {
    ...req.staff,
    twoFactorRequired: envConfig.REQUIRE_TWO_FACTOR,
  });
};

/*--POST /api/v1/auth/logout--*/
export const logout = (req: Request, res: Response) => {
  if (req.staff) audit(req, "logout", { type: "staff", id: req.staff.id });
  endSession(req, res);
  sendResponse(res, 200, "Logged out");
};

/*--GET /api/v1/auth/me--*/
export const me = (req: Request, res: Response) => {
  sendResponse(res, 200, "OK", {
    ...req.staff,
    twoFactorRequired: envConfig.REQUIRE_TWO_FACTOR,
  });
};

const changeSchema = z.object({
  currentPassword: z.string().max(200),
  newPassword: z.string().max(200),
});

/*--POST /api/v1/auth/change-password--*/
export const changePassword = async (req: Request, res: Response) => {
  const parsed = changeSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, "Current and new password are required");
  const row = db
    .prepare(`SELECT password_hash FROM staff_users WHERE id = ?`)
    .get(req.staff!.id) as { password_hash: string };
  if (!verifyPassword(parsed.data.currentPassword, row.password_hash))
    return sendResponse(res, 400, "Current password is wrong");
  const problem = passwordProblem(parsed.data.newPassword);
  if (problem) return sendResponse(res, 400, problem);
  db.prepare(`UPDATE staff_users SET password_hash = ? WHERE id = ?`).run(
    hashPassword(parsed.data.newPassword),
    req.staff!.id,
  );
  // Log out every other session of this user
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`).run(
    req.staff!.id,
    req.sessionTokenHash!,
  );
  audit(req, "password.changed", { type: "staff", id: req.staff!.id });
  return sendResponse(res, 200, "Password changed");
};

/*--Two-factor login--*/

const passwordSchema = z.object({ password: z.string().max(200) });
const codeSchema = z.object({ code: z.string().trim().max(10) });

const twoFactorRow = (id: number) =>
  db
    .prepare(
      `SELECT password_hash, totp_secret_enc, totp_enabled, totp_last_step FROM staff_users WHERE id = ?`,
    )
    .get(id) as Pick<
    StaffRow,
    "password_hash" | "totp_secret_enc" | "totp_enabled" | "totp_last_step"
  >;

/*--POST /api/v1/auth/two-factor/setup: asks for the password again, then makes a new secret and its QR code.
  Nothing changes until the first code is confirmed (enable).--*/
export const setupTwoFactor = async (req: Request, res: Response) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, "Your password is required");
  const row = twoFactorRow(req.staff!.id);
  if (!verifyPassword(parsed.data.password, row.password_hash))
    return sendResponse(res, 400, "Password is wrong");
  if (row.totp_enabled)
    return sendResponse(res, 409, "Two-factor login is already on");

  const secret = newTotpSecret();
  db.prepare(
    `UPDATE staff_users SET totp_secret_enc = ?, totp_last_step = NULL WHERE id = ?`,
  ).run(encryptText(secret), req.staff!.id);
  const url = otpauthUrl(secret, req.staff!.email);
  audit(req, "two_factor.setup_started", { type: "staff", id: req.staff!.id });
  return sendResponse(
    res,
    200,
    "Scan the QR code with your authenticator app",
    { secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) },
  );
};

/*--POST /api/v1/auth/two-factor/enable: the first code from the app turns two-factor login on--*/
export const enableTwoFactor = (req: Request, res: Response) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return sendResponse(res, 400, "Enter the 6-digit code");
  const row = twoFactorRow(req.staff!.id);
  if (row.totp_enabled)
    return sendResponse(res, 409, "Two-factor login is already on");
  if (!row.totp_secret_enc)
    return sendResponse(res, 400, "Start the set-up first");
  const step = verifyTotp(
    decryptText(row.totp_secret_enc),
    parsed.data.code,
    null,
  );
  if (step === null)
    return sendResponse(
      res,
      400,
      "Wrong or expired code. Check the time on your phone and try again.",
    );

  db.prepare(
    `UPDATE staff_users SET totp_enabled = 1, totp_last_step = ? WHERE id = ?`,
  ).run(step, req.staff!.id);
  // Log out every other session: from now on each login needs the phone
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`).run(
    req.staff!.id,
    req.sessionTokenHash!,
  );
  audit(req, "two_factor.enabled", { type: "staff", id: req.staff!.id });
  return sendResponse(res, 200, "Two-factor login is on");
};

const disableSchema = z.object({
  password: z.string().max(200),
  code: z.string().trim().max(10),
});

/*--POST /api/v1/auth/two-factor/disable: needs the password and a current code--*/
export const disableTwoFactor = (req: Request, res: Response) => {
  if (envConfig.REQUIRE_TWO_FACTOR)
    return sendResponse(
      res,
      400,
      "Two-factor login is required for all staff and can't be turned off",
    );
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, "Password and code are required");
  const row = twoFactorRow(req.staff!.id);
  if (!row.totp_enabled || !row.totp_secret_enc)
    return sendResponse(res, 400, "Two-factor login is not on");
  if (!verifyPassword(parsed.data.password, row.password_hash))
    return sendResponse(res, 400, "Password is wrong");
  if (
    verifyTotp(
      decryptText(row.totp_secret_enc),
      parsed.data.code,
      row.totp_last_step,
    ) === null
  )
    return sendResponse(res, 400, "Wrong or expired code");

  db.prepare(
    `UPDATE staff_users SET totp_enabled = 0, totp_secret_enc = NULL, totp_last_step = NULL WHERE id = ?`,
  ).run(req.staff!.id);
  audit(req, "two_factor.disabled", { type: "staff", id: req.staff!.id });
  return sendResponse(res, 200, "Two-factor login is off");
};
