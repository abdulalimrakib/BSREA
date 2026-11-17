/*--Set up the database: import the member list from the website and create the first admin account.

    npm run seed -- --admin-email you@example.com --admin-name "Your Name"

  The member list is read from data/members.private.json (git-ignored: it holds members' phone numbers and emails).
  The admin password is read from the ADMIN_PASSWORD environment variable, or typed in when asked
  (it is never passed on the command line, where it would stay in the shell history).
  Running it again is safe: members already in the database are skipped.--*/

import fs from "fs";
import path from "path";
import { db, now, transaction } from "../db/database";
import { arg, ask, closePrompt } from "./cli";
import { hashPassword, passwordProblem } from "../utils/security";
import { normalizeCompanyName } from "../utils/normalize";
import { emailIdx, encryptOptional, phoneIdx } from "../services/pii";

type JsonMember = {
  company: string;
  name: string;
  designation: string;
  mobile: string;
  email: string;
  address: string;
  website: string | null;
};

const importMembers = () => {
  // The full member list with contact details is private (git-ignored); the website only has a public version
  const file = path.resolve(__dirname, "../data/members.private.json");
  // On a live server the file is deleted after the first import, so it is fine for it to be missing
  if (!fs.existsSync(file)) {
    console.log("Members: no members.private.json here, nothing imported.");
    return;
  }
  const members = JSON.parse(fs.readFileSync(file, "utf8")) as JsonMember[];
  let added = 0;
  let skipped = 0;
  transaction(() => {
    const exists = db.prepare(`SELECT id FROM members WHERE company_norm = ?`);
    const insert = db.prepare(
      `INSERT INTO members (member_no, company, company_norm, contact_name, designation, mobile_enc, mobile_idx, email_enc, email_idx, address, website, source, joined_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?, ?)`,
    );
    members.forEach((m, i) => {
      const norm = normalizeCompanyName(m.company);
      if (!norm || exists.get(norm)) {
        skipped++;
        return;
      }
      const time = now();
      insert.run(
        `BSREA-M-0000-${String(i + 1).padStart(4, "0")}`, // imported members: real numbers to be filled in by BSREA
        m.company,
        norm,
        m.name,
        m.designation,
        encryptOptional(m.mobile),
        phoneIdx(m.mobile),
        encryptOptional(m.email),
        emailIdx(m.email),
        m.address,
        m.website,
        time,
        time,
      );
      added++;
    });
  });
  console.log(
    `Members: ${added} imported, ${skipped} already present or empty.`,
  );
};

const createAdmin = async () => {
  const email = (arg("admin-email") ?? process.env.ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    console.log("No admin account created (pass --admin-email to create one).");
    return;
  }
  if (db.prepare(`SELECT id FROM staff_users WHERE email = ?`).get(email)) {
    console.log(`Admin ${email} already exists.`);
    return;
  }
  const name = arg("admin-name") ?? "Administrator";
  const password =
    process.env.ADMIN_PASSWORD ??
    (await ask("Password for the admin account: ", true));
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  db.prepare(
    `INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES (?, ?, 'admin', ?, ?)`,
  ).run(email, name, hashPassword(password), now());
  console.log(`Admin account created for ${email}.`);
};

(async () => {
  importMembers();
  await createAdmin();
  closePrompt();
})();
