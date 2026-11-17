import { Request, Response } from "express";
import { db } from "../../db/database";
import { sendResponse } from "../../utils/response";

/*--Staff dashboard numbers and the audit log--*/

/*--GET /api/v1/admin/summary--*/
export const getSummary = (req: Request, res: Response) => {
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  sendResponse(res, 200, "OK", {
    applicationsOpen: count(
      `SELECT COUNT(*) AS n FROM applications WHERE status IN ('submitted', 'under_review')`,
    ),
    applicationsFlagged: count(
      `SELECT COUNT(*) AS n FROM applications WHERE status IN ('submitted', 'under_review') AND duplicate_report != '[]' AND duplicates_checked_by IS NULL`,
    ),
    members: count(`SELECT COUNT(*) AS n FROM members WHERE status = 'active'`),
    certificatesValid: count(
      `SELECT COUNT(*) AS n FROM certificates WHERE status = 'valid' AND valid_until >= date('now')`,
    ),
  });
};

/*--GET /api/v1/admin/audit-log – admin only--*/
export const getAuditLog = (req: Request, res: Response) => {
  sendResponse(
    res,
    200,
    "OK",
    db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 500`).all(),
  );
};
