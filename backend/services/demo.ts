import { db, now, transaction } from "../db/database";
import { emailIdx, encryptOptional, phoneIdx } from "./pii";
import { deleteDocument } from "./documents";
import { normalizeCompanyName } from "../utils/normalize";

/*--Demo data: made-up members, and a clean slate between demos (docs/demo-kit/README.md).
  Staff accounts and the audit log are kept (the audit log can't be deleted by design).--*/

const words = ["Solar", "Sun", "Green", "Bright", "Clean", "Eco", "Wind", "Power", "Future", "River"];
const kinds = ["Energy", "Power Solutions", "Renewables", "Technologies", "Engineering"];
const areas = ["Gulshan", "Banani", "Dhanmondi", "Uttara", "Mirpur", "Motijheel", "Chattogram", "Sylhet", "Khulna", "Rajshahi"];

/*--Companies that are NOT demo data. Demo companies all start with "Demo " (the demo members, and the
  companies in the demo kit). Anything else means real data, which a reset must never delete.--*/
export const realCompanies = () =>
  (db.prepare(`SELECT company FROM members WHERE company NOT LIKE 'Demo %' UNION SELECT company FROM applications WHERE company NOT LIKE 'Demo %'`).all() as { company: string }[]).map((r) => r.company);

/*--Delete every member, application (with its documents), certificate and certificate check,
  then add `count` made-up members. Gives back how much was deleted.--*/
export const replaceWithDemoData = (count = 40) => {
  const files = (db.prepare(`SELECT storage_name FROM application_documents`).all() as { storage_name: string }[]).map((d) => d.storage_name);
  const deleted = transaction(() => {
    const n = (sql: string) => db.prepare(sql).run().changes;
    // Order matters: each table is emptied before the tables it points at
    const result = {
      certificateChecks: n(`DELETE FROM certificate_scans`),
      certificates: n(`DELETE FROM certificates`),
      documents: n(`DELETE FROM application_documents`),
      applications: n(`DELETE FROM applications`),
      members: n(`DELETE FROM members`),
    };

    const insert = db.prepare(
      `INSERT INTO members (member_no, company, company_norm, contact_name, designation, mobile_enc, mobile_idx, email_enc, email_idx, address, website, membership_type, source, joined_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?, ?)`,
    );
    for (let i = 1; i <= count; i++) {
      const company = `Demo ${words[i % words.length]} ${kinds[i % kinds.length]} ${i} Ltd`;
      const mobile = `0100000${String(i).padStart(4, "0")}`; // 010… is not a Bangladeshi mobile range
      const email = `member${i}@example.com`; // example.com never receives mail
      const time = now();
      insert.run(
        `BSREA-M-DEMO-${String(i).padStart(4, "0")}`,
        company,
        normalizeCompanyName(company),
        `Demo Contact ${i}`,
        i % 3 ? "Managing Director" : "CEO",
        encryptOptional(mobile),
        phoneIdx(mobile),
        encryptOptional(email),
        emailIdx(email),
        `House ${i}, Road ${(i % 12) + 1}, ${areas[i % areas.length]}, Bangladesh`,
        null,
        i % 5 ? "general" : "associate",
        time,
        time,
      );
    }
    return result;
  });
  // The encrypted document files go after the database change is saved
  files.forEach(deleteDocument);
  return deleted;
};
