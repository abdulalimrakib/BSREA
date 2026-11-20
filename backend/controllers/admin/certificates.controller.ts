import { Request, Response } from "express";
import { z } from "zod";
import { db, now } from "../../db/database";
import { audit } from "../../services/audit";
import {
  certificatePdf,
  certificateState,
  type CertificateRow,
} from "../../services/certificates";
import { attachmentHeader, sendResponse } from "../../utils/response";
import { idParam } from "./shared";

/*--Certificates: list, download the PDF, revoke--*/

/*--GET /api/v1/admin/certificates--*/
export const listCertificates = (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM certificate_scans s WHERE s.certificate_id = c.id) AS scans,
         (SELECT MAX(at) FROM certificate_scans s WHERE s.certificate_id = c.id) AS last_scan_at,
         -- checks made while the certificate was already revoked or expired: someone may still be showing it
         (SELECT COUNT(*) FROM certificate_scans s WHERE s.certificate_id = c.id AND s.state != 'valid') AS suspicious_scans,
         (SELECT MAX(at) FROM certificate_scans s WHERE s.certificate_id = c.id AND s.state != 'valid') AS last_suspicious_at
       FROM certificates c ORDER BY c.created_at DESC LIMIT 500`,
    )
    .all() as CertificateRow[];
  sendResponse(
    res,
    200,
    "OK",
    rows.map(({ verify_code, ...c }) => ({
      ...c,
      state: certificateState(c),
      verifyCode: verify_code,
    })),
  );
};

/*--GET /api/v1/admin/certificates/:id/pdf – logged--*/
export const downloadCertificatePdf = async (req: Request, res: Response) => {
  const id = idParam(req);
  const c = id
    ? (db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(id) as
        CertificateRow | undefined)
    : undefined;
  if (!c) return sendResponse(res, 404, "Certificate not found");
  if (c.status === "revoked")
    return sendResponse(res, 409, "This certificate was revoked");
  audit(req, "certificate.downloaded", { type: "certificate", id: id! });
  const pdf = await certificatePdf(c);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    attachmentHeader(`${c.number.replace(/\//g, "-")}.pdf`),
  );
  res.send(pdf);
};

const revokeSchema = z.object({
  reason: z.string().trim().min(5, "Please give a reason").max(500),
});

/*--POST /api/v1/admin/certificates/:id/revoke – approvers only--*/
export const revokeCertificate = (req: Request, res: Response) => {
  const id = idParam(req);
  const parsed = revokeSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, parsed.error.issues[0].message);
  const result = db
    .prepare(
      `UPDATE certificates SET status = 'revoked', revoked_reason = ?, revoked_by = ?, revoked_at = ? WHERE id = ? AND status = 'valid'`,
    )
    .run(parsed.data.reason, req.staff!.id, now(), id ?? -1);
  if (!result.changes)
    return sendResponse(res, 404, "No valid certificate with this id");
  audit(
    req,
    "certificate.revoked",
    { type: "certificate", id: id! },
    { reason: parsed.data.reason },
  );
  sendResponse(res, 200, "Certificate revoked");
};
