import { NextFunction, Request, Response } from "express";
import envConfig from "../config/env.config";
import { db, now } from "../db/database";
import { randomToken, sha256 } from "../utils/security";
import { sendResponse } from "../utils/response";

/*--Staff sessions.
  The browser holds a random token in an httpOnly, SameSite=Strict cookie. The database only keeps
  its SHA-256 hash, so a leaked database can't be used to log in.--*/

export type StaffRole = "admin" | "approver" | "staff";
export type StaffUser = {
  id: number;
  email: string;
  name: string;
  role: StaffRole;
  twoFactor: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffUser;
      sessionTokenHash?: string;
    }
  }
}

export const SESSION_COOKIE = envConfig.isProduction
  ? "__Host-bsrea_staff"
  : "bsrea_staff";
const ABSOLUTE_HOURS = 24; // even an active session ends after a day

const cookieOptions = () => ({
  httpOnly: true,
  secure: envConfig.isProduction,
  sameSite: "strict" as const,
  path: "/",
});

export const startSession = (req: Request, res: Response, userId: number) => {
  const token = randomToken(32);
  const time = now();
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sha256(token),
    userId,
    time,
    time,
    new Date(Date.now() + ABSOLUTE_HOURS * 3600_000).toISOString(),
    req.ip ?? null,
    (req.get("user-agent") ?? "").slice(0, 300),
  );
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: ABSOLUTE_HOURS * 3600_000,
  });
};

export const endSession = (req: Request, res: Response) => {
  if (req.sessionTokenHash)
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(
      req.sessionTokenHash,
    );
  res.clearCookie(SESSION_COOKIE, cookieOptions());
};

/*--Look up the session (if any) and put the staff member on req.staff--*/
export const loadSession = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length < 20) return next();

  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.last_seen_at, s.expires_at, u.id, u.email, u.name, u.role, u.is_active, u.totp_enabled
       FROM sessions s JOIN staff_users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        last_seen_at: string;
        expires_at: string;
        id: number;
        email: string;
        name: string;
        role: StaffRole;
        is_active: number;
        totp_enabled: number;
      }
    | undefined;
  if (!row) return next();

  const idleLimit =
    new Date(row.last_seen_at).getTime() + envConfig.SESSION_HOURS * 3600_000;
  if (
    !row.is_active ||
    Date.now() > idleLimit ||
    Date.now() > new Date(row.expires_at).getTime()
  ) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return next();
  }

  db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`).run(
    now(),
    tokenHash,
  );
  req.staff = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    twoFactor: row.totp_enabled === 1,
  };
  req.sessionTokenHash = tokenHash;
  next();
};

/*--Logged in, even if two-factor login isn't set up yet (only for "who am I", logout and the set-up itself)--*/
export const requireLogin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.staff) return sendResponse(res, 401, "Please log in");
  next();
};

/*--Only logged-in staff (optionally only some roles) may continue. When two-factor login is required,
  staff who haven't set it up can do nothing else until they have.--*/
export const requireStaff =
  (...roles: StaffRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff) return sendResponse(res, 401, "Please log in");
    if (envConfig.REQUIRE_TWO_FACTOR && !req.staff.twoFactor) {
      return sendResponse(res, 403, "Set up two-factor login first", {
        code: "two_factor_setup_required",
      });
    }
    if (roles.length && !roles.includes(req.staff.role))
      return sendResponse(res, 403, "You don't have permission to do this");
    next();
  };
