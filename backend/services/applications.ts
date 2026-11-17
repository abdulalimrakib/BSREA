import crypto from "crypto";
import { z } from "zod";
import { db, now, transaction } from "../db/database";
import { blindIndex, encryptText } from "../utils/security";
import { normalizeCompanyName, normalizeId } from "../utils/normalize";
import { emailIdx, phoneIdx } from "./pii";
import { findDuplicates, hasBlocking, type DuplicateMatch } from "./duplicates";
import type { StoredDocument } from "./documents";

/*--Membership applications: checking the form, then saving it with its duplicate report--*/

// Membership fees (from the published fee chart). Exclusive of VAT and tax.
export const FEES = {
  local: { general: { admission: 25000, annual: 15000 }, associate: { admission: 20000, annual: 10000 }, currency: "BDT" },
  foreign: { general: { admission: 1000, annual: 500 }, currency: "USD" },
} as const;

const text = (max: number) => z.string().trim().min(1, "This field is required").max(max, `At most ${max} characters`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((v) => v || undefined);
const email = z.string().trim().max(150).email("Please enter a valid email address");
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => /^[+\d][\d\s\-()]{5,29}$/.test(v), "Please enter a valid phone number");
const registrationNo = (label: string) =>
  z
    .string()
    .trim()
    .max(40)
    .refine((v) => normalizeId(v).length >= 4, `Please enter a valid ${label}`);

export const applicationSchema = z
  .object({
    membershipType: z.enum(["general", "associate"]),
    origin: z.enum(["local", "foreign"]),
    company: text(150),
    tradeLicenseNo: registrationNo("trade licence number"),
    binNo: registrationNo("BIN"),
    tinNo: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => v || undefined)
      .refine((v) => !v || normalizeId(v).length >= 4, "Please enter a valid TIN"),
    companyEmail: email,
    companyPhone: phone,
    address: text(300),
    website: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => v || undefined)
      .refine((v) => !v || /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(v), "Website must start with http:// or https://"),
    applicantName: text(100),
    applicantDesignation: text(100),
    applicantEmail: email,
    applicantMobile: phone,
    applicantNid: registrationNo("NID or passport number"),
    contactName: optionalText(100),
    contactMobile: optionalText(30),
    contactEmail: z
      .string()
      .trim()
      .max(150)
      .optional()
      .transform((v) => v || undefined)
      .refine((v) => !v || z.string().email().safeParse(v).success, "Please enter a valid email address"),
    declaration: z.literal("yes", { message: "Please confirm the information is correct" }),
  })
  .refine((v) => !(v.origin === "foreign" && v.membershipType === "associate"), {
    path: ["membershipType"],
    message: "Foreign companies can apply for General membership only",
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;

/*--Turn zod errors into { field: "message" }--*/
export const fieldErrors = (error: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
};

/*--Everything the duplicate check needs, computed from the form--*/
export const duplicateCandidate = (input: ApplicationInput, documentHashes: string[] = []) => ({
  companyNorm: normalizeCompanyName(input.company),
  tradeLicenseIdx: blindIndex(`trade:${normalizeId(input.tradeLicenseNo)}`),
  binIdx: blindIndex(`bin:${normalizeId(input.binNo)}`),
  tinIdx: input.tinNo ? blindIndex(`tin:${normalizeId(input.tinNo)}`) : null,
  emailIdxs: [emailIdx(input.companyEmail), emailIdx(input.applicantEmail)],
  phoneIdxs: [phoneIdx(input.companyPhone), phoneIdx(input.applicantMobile)],
  applicantNidIdx: blindIndex(`nid:${normalizeId(input.applicantNid)}`),
  documentHashes,
});

const newReference = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  const bytes = crypto.randomBytes(8);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `APP-${new Date().getFullYear()}-${code}`;
};

export class DuplicateError extends Error {
  matches: DuplicateMatch[];
  constructor(matches: DuplicateMatch[]) {
    super("Duplicate");
    this.matches = matches;
  }
}

/*--Save a new application. Refuses (DuplicateError) when a blocking duplicate exists.
  The check and the insert run in one write-locked transaction, so two identical forms sent at
  the same moment can't both get in. The unique indexes in the database are a second guard.--*/
export const createApplication = (input: ApplicationInput, documents: StoredDocument[]) => {
  const candidate = duplicateCandidate(input, documents.map((d) => d.sha256));

  return transaction(() => {
    const matches = findDuplicates(candidate);
    if (hasBlocking(matches)) throw new DuplicateError(matches);

    const time = now();
    const reference = newReference();
    const result = db
      .prepare(
        `INSERT INTO applications (
          reference, membership_type, origin, company, company_norm,
          trade_license_enc, trade_license_idx, bin_enc, bin_idx, tin_enc, tin_idx,
          company_email_enc, company_email_idx, company_phone_enc, company_phone_idx, address, website,
          applicant_name_enc, applicant_designation, applicant_email_enc, applicant_email_idx,
          applicant_mobile_enc, applicant_mobile_idx, applicant_nid_enc, applicant_nid_idx,
          contact_enc, duplicate_report, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        reference,
        input.membershipType,
        input.origin,
        input.company,
        candidate.companyNorm,
        encryptText(input.tradeLicenseNo),
        candidate.tradeLicenseIdx,
        encryptText(input.binNo),
        candidate.binIdx,
        input.tinNo ? encryptText(input.tinNo) : null,
        candidate.tinIdx,
        encryptText(input.companyEmail),
        candidate.emailIdxs[0],
        encryptText(input.companyPhone),
        candidate.phoneIdxs[0],
        input.address,
        input.website ?? null,
        encryptText(input.applicantName),
        input.applicantDesignation,
        encryptText(input.applicantEmail),
        candidate.emailIdxs[1],
        encryptText(input.applicantMobile),
        candidate.phoneIdxs[1],
        encryptText(input.applicantNid),
        candidate.applicantNidIdx,
        input.contactName || input.contactMobile || input.contactEmail
          ? encryptText(JSON.stringify({ name: input.contactName ?? null, mobile: input.contactMobile ?? null, email: input.contactEmail ?? null }))
          : null,
        JSON.stringify(matches),
        time,
        time
      );
    const id = Number(result.lastInsertRowid);

    const addDoc = db.prepare(
      `INSERT INTO application_documents (application_id, kind, original_name, mime, size, sha256, storage_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of documents) addDoc.run(id, d.kind, d.originalName, d.mime, d.size, d.sha256, d.storageName, time);

    return { id, reference, reviewFlags: matches.length };
  });
};

/*--One application row, as stored--*/
export type ApplicationRow = Record<string, unknown>;

export const loadApplication = (id: number) => db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) as ApplicationRow | undefined;

/*--Re-run the duplicate check for a saved application against everything in the database right now--*/
export const liveDuplicates = (a: ApplicationRow) =>
  findDuplicates({
    companyNorm: String(a.company_norm),
    tradeLicenseIdx: String(a.trade_license_idx),
    binIdx: String(a.bin_idx),
    tinIdx: (a.tin_idx as string | null) ?? null,
    emailIdxs: [a.company_email_idx as string | null, a.applicant_email_idx as string | null],
    phoneIdxs: [a.company_phone_idx as string | null, a.applicant_mobile_idx as string | null],
    applicantNidIdx: String(a.applicant_nid_idx),
    documentHashes: (db.prepare(`SELECT sha256 FROM application_documents WHERE application_id = ?`).all(Number(a.id)) as { sha256: string }[]).map((d) => d.sha256),
    excludeApplicationId: Number(a.id),
  });
