import { Request, Response } from "express";
import { db } from "../db/database";
import {
  certificateState,
  VERIFY_CODE,
  type CertificateRow,
} from "../services/certificates";
import { sendResponse } from "../utils/response";

/*--Public: check a certificate from its QR code. Shows only what is printed on the certificate itself.--*/

/*--GET /api/v1/verify/:code--*/
export const verifyCertificate = (req: Request, res: Response) => {
  const code = String(req.params.code);
  if (!VERIFY_CODE.test(code))
    return sendResponse(res, 404, "No certificate matches this code");

  const c = db
    .prepare(`SELECT * FROM certificates WHERE verify_code = ?`)
    .get(code) as CertificateRow | undefined;
  if (!c) return sendResponse(res, 404, "No certificate matches this code");

  return sendResponse(res, 200, "Certificate found", {
    type: c.type,
    number: c.number,
    company: c.company,
    membershipType: c.membership_type,
    validFrom: c.valid_from,
    validUntil: c.valid_until,
    issuedAt: c.created_at,
    status: certificateState(c),
    revokedAt: c.status === "revoked" ? c.revoked_at : null,
  });
};
