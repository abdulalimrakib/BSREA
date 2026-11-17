import { Request, Response } from "express";
import { z } from "zod";
import { db, now } from "../../db/database";
import { audit } from "../../services/audit";
import { hashPassword, passwordProblem } from "../../utils/security";
import { sendResponse } from "../../utils/response";
import { idParam } from "./shared";

/*--Staff accounts (admin only)--*/

/*--GET /api/v1/admin/staff--*/
export const listStaff = (req: Request, res: Response) => {
  sendResponse(
    res,
    200,
    "OK",
    db
      .prepare(
        `SELECT id, email, name, role, is_active, totp_enabled, last_login_at, created_at FROM staff_users ORDER BY name`,
      )
      .all(),
  );
};

const staffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(150),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "approver", "staff"]),
  password: z.string().max(200),
});

/*--POST /api/v1/admin/staff--*/
export const createStaff = (req: Request, res: Response) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, parsed.error.issues[0].message);
  const problem = passwordProblem(parsed.data.password);
  if (problem) return sendResponse(res, 400, problem);
  if (
    db
      .prepare(`SELECT id FROM staff_users WHERE email = ?`)
      .get(parsed.data.email)
  )
    return sendResponse(
      res,
      409,
      "A staff account with this email already exists",
    );
  const result = db
    .prepare(
      `INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      parsed.data.email,
      parsed.data.name,
      parsed.data.role,
      hashPassword(parsed.data.password),
      now(),
    );
  audit(
    req,
    "staff.created",
    { type: "staff", id: Number(result.lastInsertRowid) },
    { email: parsed.data.email, role: parsed.data.role },
  );
  sendResponse(res, 201, "Staff account created", {
    id: Number(result.lastInsertRowid),
  });
};

/*--POST /api/v1/admin/staff/:id/deactivate--*/
export const deactivateStaff = (req: Request, res: Response) => {
  const id = idParam(req);
  if (id === req.staff!.id)
    return sendResponse(res, 400, "You can't deactivate your own account");
  const result = db
    .prepare(`UPDATE staff_users SET is_active = 0 WHERE id = ?`)
    .run(id ?? -1);
  if (!result.changes) return sendResponse(res, 404, "Staff account not found");
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(id!);
  audit(req, "staff.deactivated", { type: "staff", id: id! });
  sendResponse(res, 200, "Account deactivated");
};

/*--POST /api/v1/admin/staff/:id/reset-two-factor: for a lost phone. They set it up again at their next login.--*/
export const resetTwoFactor = (req: Request, res: Response) => {
  const id = idParam(req);
  if (id === req.staff!.id)
    return sendResponse(
      res,
      400,
      "Another admin must reset your own two-factor login",
    );
  const result = db
    .prepare(
      `UPDATE staff_users SET totp_enabled = 0, totp_secret_enc = NULL, totp_last_step = NULL WHERE id = ?`,
    )
    .run(id ?? -1);
  if (!result.changes) return sendResponse(res, 404, "Staff account not found");
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(id);
  audit(req, "two_factor.reset", { type: "staff", id: id! });
  sendResponse(
    res,
    200,
    "Two-factor login reset. They will set it up again at their next login.",
  );
};
