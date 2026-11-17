/*--Replace every member with made-up demo members, for a demo copy of the system.

    npm run demo-data -- --confirm            replaces the members with 40 demo members
    npm run demo-data -- --confirm --count 80

  Real people's details must not sit on a demo server. This deletes ALL members (and any
  applications and certificates, which point at real people too), then adds companies called
  "Demo ... Ltd" with example.com emails and numbers that are not real phone numbers.
  Staff accounts are kept. Delete old backups afterwards: they still contain the previous data.--*/

import { db, now, transaction } from "../db/database";
import { emailIdx, encryptOptional, phoneIdx } from "../services/pii";
import { normalizeCompanyName } from "../utils/normalize";
import { arg } from "./cli";

const words = ["Solar", "Sun", "Green", "Bright", "Clean", "Eco", "Wind", "Power", "Future", "River"];
const kinds = ["Energy", "Power Solutions", "Renewables", "Technologies", "Engineering"];
const areas = ["Gulshan", "Banani", "Dhanmondi", "Uttara", "Mirpur", "Motijheel", "Chattogram", "Sylhet", "Khulna", "Rajshahi"];

if (!process.argv.includes("--confirm")) {
  console.log("This deletes ALL members, applications and certificates and adds demo members instead.");
  console.log("Run it again with --confirm to go ahead.");
  process.exit(0);
}

const count = Math.min(Math.max(Number(arg("count")) || 40, 1), 500);

transaction(() => {
  db.prepare(`DELETE FROM certificates`).run();
  db.prepare(`DELETE FROM application_documents`).run();
  db.prepare(`DELETE FROM applications`).run();
  db.prepare(`DELETE FROM members`).run();

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
});

// Rewrite the database file so the deleted rows are really gone from disk, not just marked as free
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.exec("VACUUM");

console.log(`Members replaced: ${count} demo members. Staff accounts were kept.`);
