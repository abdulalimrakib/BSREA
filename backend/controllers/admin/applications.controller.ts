import { Request, Response } from "express";
import { z } from "zod";
import { db, now, transaction } from "../../db/database";
import { audit } from "../../services/audit";
import { liveDuplicates, loadApplication } from "../../services/applications";
import { issueMembershipCertificate } from "../../services/certificates";
import { DOCUMENT_KINDS, readDocument } from "../../services/documents";
import { hasBlocking, type DuplicateMatch } from "../../services/duplicates";
import { nextMemberNo } from "../../services/members";
import { decryptText, mask } from "../../utils/security";
import { decryptOptional } from "../../services/pii";
import { attachmentHeader, sendResponse } from "../../utils/response";
import { idParam, type Row } from "./shared";

/*--Staff review of membership applications: list, details, documents, duplicate check, approve or reject--*/

/*--GET /api/v1/admin/applications--*/
export const listApplications = (req: Request, res: Response) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : "open";
  // Only fixed SQL text is ever used; the status value itself is passed as a parameter
  const where =
    status === "open"
      ? `status IN ('submitted', 'under_review')`
      : ["approved", "rejected"].includes(status)
        ? `status = ?`
        : `1 = 1`;
  const params = ["approved", "rejected"].includes(status) ? [status] : [];
  const rows = db
    .prepare(
      `SELECT id, reference, status, membership_type, origin, company, applicant_name_enc, created_at, duplicate_report, duplicates_checked_by
       FROM applications WHERE ${where} ORDER BY created_at DESC LIMIT 500`,
    )
    .all(...params) as Row[];
  sendResponse(
    res,
    200,
    "OK",
    rows.map(({ duplicate_report, applicant_name_enc, ...r }) => {
      const matches = JSON.parse(String(duplicate_report)) as DuplicateMatch[];
      return {
        ...r,
        applicant_name: decryptOptional(applicant_name_enc),
        flags: matches.length,
        duplicatesChecked: r.duplicates_checked_by !== null,
      };
    }),
  );
};

/*--GET /api/v1/admin/applications/:id--*/
export const getApplication = (req: Request, res: Response) => {
  const id = idParam(req);
  const a = id ? loadApplication(id) : undefined;
  if (!a) return sendResponse(res, 404, "Application not found");

  const documents = db
    .prepare(
      `SELECT id, kind, original_name, mime, size, created_at FROM application_documents WHERE application_id = ? ORDER BY id`,
    )
    .all(id!) as Row[];
  const checkedBy = a.duplicates_checked_by
    ? (db
        .prepare(`SELECT name FROM staff_users WHERE id = ?`)
        .get(Number(a.duplicates_checked_by)) as { name: string } | undefined)
    : undefined;
  const reviewedBy = a.reviewed_by
    ? (db
        .prepare(`SELECT name FROM staff_users WHERE id = ?`)
        .get(Number(a.reviewed_by)) as { name: string } | undefined)
    : undefined;

  const contact = a.contact_enc
    ? (JSON.parse(decryptOptional(a.contact_enc)!) as {
        name: string | null;
        mobile: string | null;
        email: string | null;
      })
    : null;

  audit(req, "application.viewed", { type: "application", id: id! });
  sendResponse(res, 200, "OK", {
    id: a.id,
    reference: a.reference,
    status: a.status,
    membershipType: a.membership_type,
    origin: a.origin,
    company: a.company,
    // ID numbers are masked; approvers can reveal them one at a time (logged)
    tradeLicenseNo: mask(decryptText(String(a.trade_license_enc))),
    binNo: mask(decryptText(String(a.bin_enc))),
    tinNo: a.tin_enc ? mask(decryptText(String(a.tin_enc))) : null,
    applicantNid: mask(decryptText(String(a.applicant_nid_enc))),
    companyEmail: decryptOptional(a.company_email_enc),
    companyPhone: decryptOptional(a.company_phone_enc),
    address: a.address,
    website: a.website,
    applicantName: decryptOptional(a.applicant_name_enc),
    applicantDesignation: a.applicant_designation,
    applicantEmail: decryptOptional(a.applicant_email_enc),
    applicantMobile: decryptOptional(a.applicant_mobile_enc),
    contactName: contact?.name ?? null,
    contactMobile: contact?.mobile ?? null,
    contactEmail: contact?.email ?? null,
    createdAt: a.created_at,
    reviewedAt: a.reviewed_at,
    reviewedBy: reviewedBy?.name ?? null,
    decisionNote: a.decision_note,
    memberId: a.member_id,
    duplicatesAtSubmission: JSON.parse(String(a.duplicate_report)),
    duplicatesNow: ["submitted", "under_review"].includes(String(a.status))
      ? liveDuplicates(a)
      : [],
    duplicatesCheckedBy: checkedBy?.name ?? null,
    documents: documents.map((d) => ({
      ...d,
      label:
        DOCUMENT_KINDS[d.kind as keyof typeof DOCUMENT_KINDS]?.label ?? d.kind,
    })),
  });
};

const revealSchema = z.object({
  field: z.enum(["tradeLicenseNo", "binNo", "tinNo", "applicantNid"]),
});
const revealColumns = {
  tradeLicenseNo: "trade_license_enc",
  binNo: "bin_enc",
  tinNo: "tin_enc",
  applicantNid: "applicant_nid_enc",
} as const;

/*--POST /api/v1/admin/applications/:id/reveal – approvers only, logged--*/
export const revealApplicationField = (req: Request, res: Response) => {
  const id = idParam(req);
  const parsed = revealSchema.safeParse(req.body);
  const a = id ? loadApplication(id) : undefined;
  if (!a || !parsed.success) return sendResponse(res, 404, "Not found");
  const value = a[revealColumns[parsed.data.field]];
  audit(
    req,
    "application.revealed_id",
    { type: "application", id: id! },
    { field: parsed.data.field },
  );
  sendResponse(res, 200, "OK", {
    value: value ? decryptText(String(value)) : null,
  });
};

/*--GET /api/v1/admin/applications/:id/documents/:docId – logged--*/
export const downloadDocument = (req: Request, res: Response) => {
  const id = idParam(req);
  const docId = Number(req.params.docId);
  const d = db
    .prepare(
      `SELECT * FROM application_documents WHERE id = ? AND application_id = ?`,
    )
    .get(docId, id ?? -1) as Row | undefined;
  if (!d) return sendResponse(res, 404, "Document not found");
  audit(
    req,
    "document.downloaded",
    { type: "application", id: id! },
    { documentId: docId, kind: d.kind },
  );
  const data = readDocument(String(d.storage_name));
  res.setHeader("Content-Type", String(d.mime));
  res.setHeader(
    "Content-Disposition",
    attachmentHeader(String(d.original_name)),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(data);
};

const setStatus = (id: number, status: string) =>
  db
    .prepare(`UPDATE applications SET status = ?, updated_at = ? WHERE id = ?`)
    .run(status, now(), id);

/*--POST /api/v1/admin/applications/:id/start-review--*/
export const startReview = (req: Request, res: Response) => {
  const id = idParam(req);
  const a = id ? loadApplication(id) : undefined;
  if (!a) return sendResponse(res, 404, "Application not found");
  if (a.status !== "submitted")
    return sendResponse(
      res,
      409,
      "Only new applications can be moved to review",
    );
  setStatus(id!, "under_review");
  audit(req, "application.review_started", { type: "application", id: id! });
  sendResponse(res, 200, "Moved to review");
};

/*--A staff member confirms they looked at every possible duplicate and it is a genuinely separate company--*/
const ackSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Please say why these are not duplicates")
    .max(1000),
});

/*--POST /api/v1/admin/applications/:id/duplicates-checked--*/
export const markDuplicatesChecked = (req: Request, res: Response) => {
  const id = idParam(req);
  const a = id ? loadApplication(id) : undefined;
  if (!a) return sendResponse(res, 404, "Application not found");
  if (!["submitted", "under_review"].includes(String(a.status)))
    return sendResponse(res, 409, "This application is already decided");
  const parsed = ackSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, parsed.error.issues[0].message);
  const matches = liveDuplicates(a);
  if (hasBlocking(matches))
    return sendResponse(
      res,
      409,
      "This application matches an existing member or application exactly and can't be cleared",
      matches,
    );
  db.prepare(
    `UPDATE applications SET duplicates_checked_by = ?, duplicate_report = ?, updated_at = ? WHERE id = ?`,
  ).run(req.staff!.id, JSON.stringify(matches), now(), id!);
  audit(
    req,
    "application.duplicates_checked",
    { type: "application", id: id! },
    { note: parsed.data.note, matches: matches.length },
  );
  sendResponse(res, 200, "Marked as checked");
};

/*--POST /api/v1/admin/applications/:id/approve – approvers only--*/
export const approveApplication = (req: Request, res: Response) => {
  const id = idParam(req);
  if (!id) return sendResponse(res, 404, "Application not found");
  const note =
    typeof req.body?.note === "string"
      ? req.body.note.trim().slice(0, 1000)
      : null;

  try {
    const result = transaction(() => {
      const a = loadApplication(id);
      if (!a) return { status: 404, message: "Application not found" } as const;
      if (!["submitted", "under_review"].includes(String(a.status)))
        return {
          status: 409,
          message: "This application is already decided",
        } as const;

      // Check again right before approving: someone else may have become a member since
      const matches = liveDuplicates(a);
      if (hasBlocking(matches))
        return {
          status: 409,
          message:
            "Can't approve: this matches an existing member or open application exactly",
          data: matches,
        } as const;
      if (matches.length && !a.duplicates_checked_by) {
        return {
          status: 409,
          message:
            "Possible duplicates must be checked and confirmed before approval",
          data: matches,
        } as const;
      }
      if (a.duplicates_checked_by === req.staff!.id && matches.length) {
        // Four-eyes rule: the person who cleared the duplicates can't also approve
        return {
          status: 409,
          message:
            "Another person must approve an application whose duplicates you cleared",
        } as const;
      }

      const time = now();
      const member = db
        .prepare(
          `INSERT INTO members (member_no, company, company_norm, contact_name, designation, mobile_enc, mobile_idx, email_enc, email_idx, address, website,
             membership_type, origin, trade_license_idx, bin_idx, tin_idx, status, source, application_id, joined_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'application', ?, ?, ?)`,
        )
        .run(
          nextMemberNo(),
          String(a.company),
          String(a.company_norm),
          decryptOptional(a.applicant_name_enc) ?? "",
          String(a.applicant_designation),
          (a.applicant_mobile_enc as string | null) ?? null, // already encrypted: copied as is
          (a.applicant_mobile_idx as string | null) ?? null,
          (a.company_email_enc as string | null) ?? null,
          (a.company_email_idx as string | null) ?? null,
          String(a.address),
          (a.website as string | null) ?? null,
          String(a.membership_type),
          String(a.origin),
          String(a.trade_license_idx),
          String(a.bin_idx),
          (a.tin_idx as string | null) ?? null,
          id,
          time,
          time,
        );
      const memberId = Number(member.lastInsertRowid);
      db.prepare(
        `UPDATE applications SET status = 'approved', reviewed_by = ?, reviewed_at = ?, decision_note = ?, member_id = ?, updated_at = ? WHERE id = ?`,
      ).run(req.staff!.id, time, note, memberId, time, id);
      const certificateId = issueMembershipCertificate(memberId, req.staff!.id);
      return { status: 200, memberId, certificateId } as const;
    });

    if (result.status !== 200)
      return sendResponse(
        res,
        result.status,
        result.message,
        "data" in result ? result.data : null,
      );
    audit(
      req,
      "application.approved",
      { type: "application", id },
      { memberId: result.memberId, certificateId: result.certificateId },
    );
    return sendResponse(
      res,
      200,
      "Approved: member added and certificate issued",
      result,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed/.test(error.message)
    ) {
      return sendResponse(
        res,
        409,
        "Can't approve: a member with the same company or registration numbers already exists",
      );
    }
    throw error;
  }
};

const rejectSchema = z.object({
  reason: z.string().trim().min(5, "Please give a reason").max(1000),
});

/*--POST /api/v1/admin/applications/:id/reject – approvers only--*/
export const rejectApplication = (req: Request, res: Response) => {
  const id = idParam(req);
  const a = id ? loadApplication(id) : undefined;
  if (!a) return sendResponse(res, 404, "Application not found");
  if (!["submitted", "under_review"].includes(String(a.status)))
    return sendResponse(res, 409, "This application is already decided");
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success)
    return sendResponse(res, 400, parsed.error.issues[0].message);
  const time = now();
  db.prepare(
    `UPDATE applications SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, decision_note = ?, updated_at = ? WHERE id = ?`,
  ).run(req.staff!.id, time, parsed.data.reason, time, id!);
  audit(
    req,
    "application.rejected",
    { type: "application", id: id! },
    { reason: parsed.data.reason },
  );
  sendResponse(res, 200, "Application rejected");
};
