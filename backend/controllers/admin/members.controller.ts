import { Request, Response } from "express";
import { db } from "../../db/database";
import { audit } from "../../services/audit";
import {
  CertificateExistsError,
  issueMembershipCertificate,
} from "../../services/certificates";
import { memberDuplicateReport } from "../../services/duplicates";
import { decryptOptional, emailIdx, phoneIdx } from "../../services/pii";
import { sendResponse } from "../../utils/response";
import { idParam } from "./shared";

/*--Members: search, possible duplicates among existing members, issuing this year's certificate--*/

/*--GET /api/v1/admin/members--*/
export const listMembers = (req: Request, res: Response) => {
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  // Emails and phone numbers are encrypted, so they are found by exact fingerprint, not by partial text
  const qEmail = emailIdx(q) ?? "-";
  const qPhone = phoneIdx(q) ?? "-";
  const rows = db
    .prepare(
      `SELECT m.id, m.member_no, m.company, m.contact_name, m.designation, m.mobile_enc, m.email_enc, m.membership_type, m.status, m.source, m.joined_at,
         (SELECT COUNT(*) FROM certificates c WHERE c.member_id = m.id AND c.status = 'valid' AND c.valid_until >= date('now')) AS valid_certificates
       FROM members m
       WHERE ? = '' OR m.company LIKE ? ESCAPE '\\' OR m.member_no LIKE ? ESCAPE '\\' OR m.contact_name LIKE ? ESCAPE '\\' OR m.email_idx = ? OR m.mobile_idx = ?
       ORDER BY m.company LIMIT 500`,
    )
    .all(q, like, like, like, qEmail, qPhone) as Record<string, unknown>[];
  sendResponse(
    res,
    200,
    "OK",
    rows.map(({ mobile_enc, email_enc, ...m }) => ({
      ...m,
      mobile: decryptOptional(mobile_enc) ?? "",
      email: decryptOptional(email_enc) ?? "",
    })),
  );
};

/*--GET /api/v1/admin/members/duplicates--*/
export const listMemberDuplicates = (req: Request, res: Response) => {
  sendResponse(res, 200, "OK", memberDuplicateReport());
};

/*--POST /api/v1/admin/members/:id/certificates – approvers only--*/
export const issueMemberCertificate = (req: Request, res: Response) => {
  const id = idParam(req);
  if (!id) return sendResponse(res, 404, "Member not found");
  try {
    const certificateId = issueMembershipCertificate(id, req.staff!.id);
    audit(
      req,
      "certificate.issued",
      { type: "certificate", id: certificateId },
      { memberId: id },
    );
    sendResponse(res, 201, "Certificate issued", { id: certificateId });
  } catch (error) {
    if (error instanceof CertificateExistsError)
      return sendResponse(res, 409, error.message);
    if (
      error instanceof Error &&
      /not found|active members/.test(error.message)
    )
      return sendResponse(res, 400, error.message);
    throw error;
  }
};
