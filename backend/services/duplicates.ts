import { db } from "../db/database";
import { nameSimilarity } from "../utils/normalize";

/*--Duplicate checks for membership applications.

  "block"  = it can't be allowed (same company, trade licence, BIN or TIN as an existing member
             or an open application). The application is refused.
  "review" = it may be fine but a person must look (same email, phone or applicant NID; a similar
             company name; the same document file). Real BSREA data has sister companies that share
             an owner's email and phone, so these are flagged, not refused.

  The public only ever hears "a matching record exists"; which member matched is shown to staff only,
  so the apply form can't be used to find out who is a member or what their IDs are.--*/

export type DuplicateLevel = "block" | "review";

export type DuplicateMatch = {
  level: DuplicateLevel;
  field: "company" | "trade_license" | "bin" | "tin" | "email" | "phone" | "applicant_nid" | "document";
  match: "exact" | "similar";
  against: "member" | "application";
  id: number;
  label: string; // company name and number/reference, for staff
  score?: number; // name similarity 0–1
};

export type DuplicateCandidate = {
  companyNorm: string;
  tradeLicenseIdx: string;
  binIdx: string;
  tinIdx: string | null;
  emailIdxs: (string | null)[]; // blind indexes (see services/pii.ts)
  phoneIdxs: (string | null)[];
  applicantNidIdx: string;
  documentHashes?: string[];
  excludeApplicationId?: number; // when re-checking an application against everything else
};

// 0.88 catches typos ("Engineerng" = 0.93) but not different firms that share words ("A and A Trade" vs "Vcon Trade" = 0.85)
const SIMILAR_NAME = 0.88;
const OPEN = "('submitted', 'under_review')";

type Row = Record<string, string | number | null>;

export const findDuplicates = (c: DuplicateCandidate): DuplicateMatch[] => {
  const found: DuplicateMatch[] = [];
  const exclude = c.excludeApplicationId ?? -1;
  const add = (m: DuplicateMatch) => {
    if (!found.some((f) => f.field === m.field && f.against === m.against && f.id === m.id)) found.push(m);
  };
  const memberLabel = (r: Row) => `${r.company} (${r.member_no})`;
  const appLabel = (r: Row) => `${r.company} (application ${r.reference})`;

  // Exact identity matches: block
  const idChecks: { field: DuplicateMatch["field"]; memberCol: string; appCol: string; value: string | null }[] = [
    { field: "company", memberCol: "company_norm", appCol: "company_norm", value: c.companyNorm },
    { field: "trade_license", memberCol: "trade_license_idx", appCol: "trade_license_idx", value: c.tradeLicenseIdx },
    { field: "bin", memberCol: "bin_idx", appCol: "bin_idx", value: c.binIdx },
    { field: "tin", memberCol: "tin_idx", appCol: "tin_idx", value: c.tinIdx },
  ];
  for (const check of idChecks) {
    if (!check.value) continue;
    for (const r of db.prepare(`SELECT id, company, member_no FROM members WHERE ${check.memberCol} = ?`).all(check.value) as Row[]) {
      add({ level: "block", field: check.field, match: "exact", against: "member", id: Number(r.id), label: memberLabel(r) });
    }
    for (const r of db
      .prepare(`SELECT id, company, reference FROM applications WHERE ${check.appCol} = ? AND status IN ${OPEN} AND id != ?`)
      .all(check.value, exclude) as Row[]) {
      add({ level: "block", field: check.field, match: "exact", against: "application", id: Number(r.id), label: appLabel(r) });
    }
  }

  // Similar company names: review (catches "Humayun Trading" vs "Humayun Trading Corporation (Safari Solar)")
  if (c.companyNorm) {
    for (const r of db.prepare(`SELECT id, company, member_no, company_norm FROM members`).all() as Row[]) {
      const score = nameSimilarity(c.companyNorm, String(r.company_norm));
      if (score >= SIMILAR_NAME && r.company_norm !== c.companyNorm) {
        add({ level: "review", field: "company", match: "similar", against: "member", id: Number(r.id), label: memberLabel(r), score: Math.round(score * 100) / 100 });
      }
    }
    for (const r of db
      .prepare(`SELECT id, company, reference, company_norm FROM applications WHERE status IN ${OPEN} AND id != ?`)
      .all(exclude) as Row[]) {
      const score = nameSimilarity(c.companyNorm, String(r.company_norm));
      if (score >= SIMILAR_NAME && r.company_norm !== c.companyNorm) {
        add({ level: "review", field: "company", match: "similar", against: "application", id: Number(r.id), label: appLabel(r), score: Math.round(score * 100) / 100 });
      }
    }
  }

  // Shared contact details: review
  for (const email of new Set(c.emailIdxs.filter((v): v is string => !!v))) {
    for (const r of db.prepare(`SELECT id, company, member_no FROM members WHERE email_idx = ?`).all(email) as Row[]) {
      add({ level: "review", field: "email", match: "exact", against: "member", id: Number(r.id), label: memberLabel(r) });
    }
    for (const r of db
      .prepare(`SELECT id, company, reference FROM applications WHERE (company_email_idx = ? OR applicant_email_idx = ?) AND status IN ${OPEN} AND id != ?`)
      .all(email, email, exclude) as Row[]) {
      add({ level: "review", field: "email", match: "exact", against: "application", id: Number(r.id), label: appLabel(r) });
    }
  }
  for (const phone of new Set(c.phoneIdxs.filter((v): v is string => !!v))) {
    for (const r of db.prepare(`SELECT id, company, member_no FROM members WHERE mobile_idx = ?`).all(phone) as Row[]) {
      add({ level: "review", field: "phone", match: "exact", against: "member", id: Number(r.id), label: memberLabel(r) });
    }
    for (const r of db
      .prepare(`SELECT id, company, reference FROM applications WHERE (company_phone_idx = ? OR applicant_mobile_idx = ?) AND status IN ${OPEN} AND id != ?`)
      .all(phone, phone, exclude) as Row[]) {
      add({ level: "review", field: "phone", match: "exact", against: "application", id: Number(r.id), label: appLabel(r) });
    }
  }

  // Same person applying for several companies (by NID/passport fingerprint): review, including past approved ones
  for (const r of db
    .prepare(`SELECT id, company, reference FROM applications WHERE applicant_nid_idx = ? AND status != 'rejected' AND id != ?`)
    .all(c.applicantNidIdx, exclude) as Row[]) {
    add({ level: "review", field: "applicant_nid", match: "exact", against: "application", id: Number(r.id), label: appLabel(r) });
  }

  // The same document file was uploaded with another application: review
  for (const hash of new Set(c.documentHashes ?? [])) {
    for (const r of db
      .prepare(
        `SELECT DISTINCT a.id, a.company, a.reference FROM application_documents d JOIN applications a ON a.id = d.application_id
         WHERE d.sha256 = ? AND a.id != ?`
      )
      .all(hash, exclude) as Row[]) {
      add({ level: "review", field: "document", match: "exact", against: "application", id: Number(r.id), label: appLabel(r) });
    }
  }

  return found;
};

export const hasBlocking = (matches: DuplicateMatch[]) => matches.some((m) => m.level === "block");

/*--Report of possible duplicates among existing members (e.g. the imported list)--*/
export const memberDuplicateReport = () => {
  const members = db.prepare(`SELECT id, member_no, company, company_norm, email_idx, mobile_idx FROM members ORDER BY id`).all() as Row[];
  const groups: { reason: string; members: { id: number; member_no: string; company: string }[]; score?: number }[] = [];
  const pick = (r: Row) => ({ id: Number(r.id), member_no: String(r.member_no), company: String(r.company) });

  for (const [col, reason] of [
    ["email_idx", "Same email"],
    ["mobile_idx", "Same phone"],
  ] as const) {
    const byValue = new Map<string, Row[]>();
    for (const r of members) {
      const v = r[col];
      if (typeof v !== "string" || !v) continue;
      byValue.set(v, [...(byValue.get(v) ?? []), r]);
    }
    for (const rows of byValue.values()) if (rows.length > 1) groups.push({ reason, members: rows.map(pick) });
  }
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const score = nameSimilarity(String(members[i].company_norm), String(members[j].company_norm));
      if (score >= SIMILAR_NAME) groups.push({ reason: "Similar company name", members: [pick(members[i]), pick(members[j])], score: Math.round(score * 100) / 100 });
    }
  }
  return groups;
};
