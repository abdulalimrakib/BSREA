import type {} from "../middleware/auth"; // adds req.staff
import { Request } from "express";
import { db, now } from "../db/database";

/*--Write one line to the audit log: who did what, to what, from where--*/
export const audit = (
  req: Request | null,
  action: string,
  target?: { type: string; id: string | number },
  details?: Record<string, unknown>
) => {
  const actor = req?.staff;
  db.prepare(
    `INSERT INTO audit_log (at, actor_id, actor_email, action, target_type, target_id, ip, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    now(),
    actor?.id ?? null,
    actor?.email ?? null,
    action,
    target?.type ?? null,
    target ? String(target.id) : null,
    req?.ip ?? null,
    details ? JSON.stringify(details) : null
  );
};
