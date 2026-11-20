import { Request, Response } from "express";
import { db, now } from "../db/database";
import {
  certificateState,
  VERIFY_CODE,
  type CertificateRow,
} from "../services/certificates";
import { maskIp } from "../utils/security";
import { sendResponse } from "../utils/response";

/*--Public: check a certificate from its QR code. Shows only what is printed on the certificate itself,
  so the checker can compare every detail with the paper.--*/

/*--GET /api/v1/verify/:code--*/
export const verifyCertificate = (req: Request, res: Response) => {
  const code = String(req.params.code);
  if (!VERIFY_CODE.test(code))
    return sendResponse(res, 404, "No certificate matches this code");

  const c = db
    .prepare(
      `SELECT c.*, m.member_no FROM certificates c JOIN members m ON m.id = c.member_id WHERE c.verify_code = ?`,
    )
    .get(code) as (CertificateRow & { member_no: string }) | undefined;
  if (!c) return sendResponse(res, 404, "No certificate matches this code");

  const state = certificateState(c);
  // Remember the check, so staff notice revoked or expired certificates that are still being shown to people
  db.prepare(
    `INSERT INTO certificate_scans (certificate_id, at, state, ip_masked) VALUES (?, ?, ?, ?)`,
  ).run(c.id, now(), state, req.ip ? maskIp(req.ip) : null);

  return sendResponse(res, 200, "Certificate found", {
    type: c.type,
    number: c.number,
    memberNo: c.member_no,
    company: c.company,
    membershipType: c.membership_type,
    validFrom: c.valid_from,
    validUntil: c.valid_until,
    issuedAt: c.created_at,
    status: state,
    revokedAt: c.status === "revoked" ? c.revoked_at : null,
  });
};
