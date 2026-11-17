import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*--End-to-end checks of the membership flow, with the focus on security and duplicates--*/

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-membership-"));
let app: Express;
let db: typeof import("../db/database").db;
let hashPassword: typeof import("../utils/security").hashPassword;

const PASSWORD = "Correct-Horse-42";
const PDF = Buffer.from("%PDF-1.4\n% test document\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORAGE_DIR", dir);
  vi.stubEnv("DATABASE_FILE", ":memory:");
  vi.stubEnv("ENCRYPTION_KEY", "11".repeat(32));
  vi.stubEnv("BLIND_INDEX_KEY", "22".repeat(32));
  app = (await import("../app")).default;
  db = (await import("../db/database")).db;
  hashPassword = (await import("../utils/security")).hashPassword;

  // One existing member, as if imported from the website
  const pii = await import("../services/pii");
  db.prepare(
    `INSERT INTO members (member_no, company, company_norm, email_enc, email_idx, mobile_enc, mobile_idx, source, joined_at, created_at)
     VALUES ('BSREA-M-0000-0001', 'Bengal Renewable Energy Limited', 'bengalrenewableenergy', ?, ?, ?, ?, 'import', '2020-01-01', '2020-01-01')`
  ).run(pii.encryptOptional("owner@sister.test"), pii.emailIdx("owner@sister.test"), pii.encryptOptional("01711523423"), pii.phoneIdx("01711523423"));
  for (const [email, role] of [
    ["admin@test.bd", "admin"],
    ["approver@test.bd", "approver"],
    ["staff@test.bd", "staff"],
  ]) {
    db.prepare(`INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, '2026-01-01')`).run(email, role, role, hashPassword(PASSWORD));
  }
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

let counter = 0;
const form = (overrides: Record<string, string> = {}) => {
  counter++;
  return {
    membershipType: "general",
    origin: "local",
    company: `Test Solar Company ${counter} Ltd`,
    tradeLicenseNo: `TRAD/DNCC/${100000 + counter}/2026`,
    binNo: `00${5000000 + counter}`,
    companyEmail: `info${counter}@testsolar${counter}.com`,
    companyPhone: `0171${String(1000000 + counter).slice(-7)}`,
    address: "House 1, Road 2, Gulshan, Dhaka",
    applicantName: "Test Applicant",
    applicantDesignation: "Managing Director",
    applicantEmail: `md${counter}@testsolar${counter}.com`,
    applicantMobile: `0181${String(1000000 + counter).slice(-7)}`,
    applicantNid: `19${String(8000000000 + counter)}`,
    declaration: "yes",
    ...overrides,
  };
};

const submit = (fields: Record<string, string>, files: Record<string, Buffer> = {}) => {
  let req = request(app).post("/api/v1/applications");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  const docs = { trade_license: PDF, tax_acknowledgement: PDF, bin_certificate: PDF, applicant_id: PDF, applicant_photo: PNG, payment_receipt: PDF, ...files };
  for (const [k, v] of Object.entries(docs)) req = req.attach(k, Buffer.concat([v, Buffer.from(`${k}-${counter}-${Math.random()}`)]), `${k}.${v === PNG ? "png" : "pdf"}`);
  return req;
};

const login = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
};

describe("submitting an application", () => {
  it("accepts a valid application and gives a reference", async () => {
    const res = await submit(form());
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^APP-\d{4}-[A-Z2-9]{8}$/);
  });

  it("explains every missing field and file", async () => {
    const res = await request(app).post("/api/v1/applications").field("company", "X");
    expect(res.status).toBe(400);
    expect(res.body.data).toMatchObject({ tradeLicenseNo: expect.any(String), declaration: expect.any(String), trade_license: expect.any(String) });
  });

  it("refuses a file that only pretends to be a PDF", async () => {
    const res = await submit(form(), { trade_license: Buffer.from("MZ\x90\x00 this is an exe") });
    expect(res.status).toBe(400);
    expect(res.body.data.trade_license).toMatch(/PDF, JPG or PNG/);
  });

  it("stores personal details, ID numbers and documents encrypted, never in plain text", async () => {
    const nid = "1990123456789";
    const personal = {
      applicantNid: nid,
      tradeLicenseNo: "PLAIN-TL-998877",
      applicantName: "Plaintext Person",
      applicantEmail: "plain.person@private.test",
      applicantMobile: "01999888777",
      companyEmail: "office@private.test",
      companyPhone: "01555444333",
      contactName: "Contact Plainname",
      contactMobile: "01666555444",
      contactEmail: "contact@private.test",
    };
    const res = await submit(form(personal));
    expect(res.status).toBe(201);
    const row = db.prepare(`SELECT * FROM applications WHERE reference = ?`).get(res.body.data.reference) as Record<string, string>;
    const stored = JSON.stringify(row).toLowerCase();
    for (const value of Object.values(personal)) {
      expect(stored).not.toContain(value.toLowerCase());
    }
    for (const file of fs.readdirSync(path.join(dir, "documents"))) {
      expect(fs.readFileSync(path.join(dir, "documents", file)).includes("%PDF")).toBe(false);
    }
  });
});

describe("duplicate checks", () => {
  it("blocks the same trade licence even when typed differently, without saying who matched", async () => {
    await submit(form({ tradeLicenseNo: "TRAD/DNCC/777777/2026" })).expect(201);
    const res = await submit(form({ tradeLicenseNo: "trad dncc 777777 2026" }));
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toMatch(/Test Solar Company/);
    expect(res.body.data).toBeNull();
  });

  it("blocks the same company name written another way (Ltd. vs Limited)", async () => {
    await submit(form({ company: "Sunrise Power Limited" })).expect(201);
    await submit(form({ company: "M/S. Sunrise Power Ltd." })).expect(409);
  });

  it("blocks a company that is already a member", async () => {
    await submit(form({ company: "Bengal Renewable Energy Ltd" })).expect(409);
  });

  it("blocks the same BIN and the same TIN", async () => {
    await submit(form({ binNo: "000111222333", tinNo: "TIN-555666777" })).expect(201);
    await submit(form({ binNo: "000-111-222-333" })).expect(409);
    await submit(form({ tinNo: "tin 555666777" })).expect(409);
  });

  it("lets only one of two identical applications sent at the same moment through", async () => {
    const fields = form({ company: "Race Condition Energy Ltd" });
    const results = await Promise.all([submit(fields), submit(fields)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("refuses repeat submissions of the same form through the database's own unique rules too", () => {
    const sample = db.prepare(`SELECT * FROM applications WHERE status = 'submitted' LIMIT 1`).get() as Record<string, unknown>;
    const columns = Object.keys(sample).filter((c) => c !== "id");
    const copy: Record<string, unknown> = { ...sample, reference: "APP-COPY" };
    expect(() =>
      db.prepare(`INSERT INTO applications (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...columns.map((c) => copy[c] as string))
    ).toThrow(/UNIQUE/);
  });
});

describe("review and approval", () => {
  let flaggedId: number;

  it("flags (but accepts) a sister company that shares a member's email and phone", async () => {
    const res = await submit(form({ company: "Power Utility Bangladesh Limited", companyEmail: "OWNER@Sister.test", companyPhone: "+880 1711-523423" }));
    expect(res.status).toBe(201);
    const row = db.prepare(`SELECT id, duplicate_report FROM applications WHERE reference = ?`).get(res.body.data.reference) as { id: number; duplicate_report: string };
    const fields = JSON.parse(row.duplicate_report).map((m: { field: string }) => m.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "phone"]));
    flaggedId = row.id;
  });

  it("won't approve until a person has checked the possible duplicates", async () => {
    const approver = await login("approver@test.bd");
    const res = await approver.post(`/api/v1/admin/applications/${flaggedId}/approve`).send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/checked/);
  });

  it("doesn't let ordinary staff approve", async () => {
    const staff = await login("staff@test.bd");
    await staff.post(`/api/v1/admin/applications/${flaggedId}/approve`).send({}).expect(403);
  });

  it("needs a second person to approve after someone cleared the duplicates (four-eyes)", async () => {
    const approver = await login("approver@test.bd");
    await approver.post(`/api/v1/admin/applications/${flaggedId}/duplicates-checked`).send({ note: "Sister concern, separate trade licence" }).expect(200);
    const same = await approver.post(`/api/v1/admin/applications/${flaggedId}/approve`).send({});
    expect(same.status).toBe(409);
    expect(same.body.message).toMatch(/Another person/);

    const admin = await login("admin@test.bd");
    const res = await admin.post(`/api/v1/admin/applications/${flaggedId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.certificateId).toBeGreaterThan(0);
  });

  it("issues a certificate that can be verified, and shows it as revoked once revoked", async () => {
    const admin = await login("admin@test.bd");
    const certs = (await admin.get("/api/v1/admin/certificates")).body.data as { id: number; verifyCode: string; company: string }[];
    const cert = certs.find((c) => c.company === "Power Utility Bangladesh Limited")!;

    const ok = await request(app).get(`/api/v1/verify/${cert.verifyCode}`);
    expect(ok.body.data).toMatchObject({ status: "valid", company: "Power Utility Bangladesh Limited" });
    expect(JSON.stringify(ok.body)).not.toMatch(/sister\.test|1711/); // no personal data on the public page

    const pdf = await admin.get(`/api/v1/admin/certificates/${cert.id}/pdf`).buffer(true);
    expect(pdf.headers["content-type"]).toBe("application/pdf");

    // No second valid certificate for the same year
    const member = db.prepare(`SELECT id FROM members WHERE company = ?`).get("Power Utility Bangladesh Limited") as { id: number };
    await admin.post(`/api/v1/admin/members/${member.id}/certificates`).send({}).expect(409);

    await admin.post(`/api/v1/admin/certificates/${cert.id}/revoke`).send({ reason: "Issued by mistake" }).expect(200);
    expect((await request(app).get(`/api/v1/verify/${cert.verifyCode}`)).body.data.status).toBe("revoked");
  });

  it("answers 404 for unknown or malformed verification codes", async () => {
    await request(app).get("/api/v1/verify/AAAAAAAAAAAAAAAAAAAAAAAA").expect(404);
    await request(app).get("/api/v1/verify/' OR 1=1 --").expect(404);
  });

  it("blocks a new application from the company that was just approved", async () => {
    await submit(form({ company: "Power Utility Bangladesh Ltd." })).expect(409);
  });
});

describe("staff login and access", () => {
  it("rejects requests without a session", async () => {
    await request(app).get("/api/v1/admin/applications").expect(401);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const a = await request(app).post("/api/v1/auth/login").send({ email: "nobody@test.bd", password: "x" });
    const b = await request(app).post("/api/v1/auth/login").send({ email: "staff@test.bd", password: "wrong" });
    expect([a.status, a.body.message]).toEqual([b.status, b.body.message]);
  });

  it("locks an account after 5 wrong passwords from the same address", async () => {
    for (let i = 0; i < 5; i++) await request(app).post("/api/v1/auth/login").send({ email: "admin@test.bd", password: "wrong" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "admin@test.bd", password: PASSWORD });
    expect(res.status).toBe(423);
    db.prepare(`DELETE FROM login_failures`).run();
  });

  it("sets an httpOnly, SameSite=Strict session cookie and keeps only its hash", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "staff@test.bd", password: PASSWORD });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const token = cookie.split(";")[0].split("=")[1];
    expect(db.prepare(`SELECT 1 FROM sessions WHERE token_hash = ?`).get(token)).toBeUndefined();
  });

  it("refuses changes sent from another website", async () => {
    const res = await request(app).post("/api/v1/auth/login").set("Origin", "https://evil.example").send({ email: "staff@test.bd", password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it("keeps ID numbers masked unless an approver reveals one, and logs it", async () => {
    const staff = await login("staff@test.bd");
    const list = (await staff.get("/api/v1/admin/applications")).body.data as { id: number }[];
    const detail = (await staff.get(`/api/v1/admin/applications/${list[0].id}`)).body.data;
    expect(detail.applicantNid).toMatch(/^\*+\d{4}$/);
    await staff.post(`/api/v1/admin/applications/${list[0].id}/reveal`).send({ field: "applicantNid" }).expect(403);

    const approver = await login("approver@test.bd");
    const revealed = await approver.post(`/api/v1/admin/applications/${list[0].id}/reveal`).send({ field: "applicantNid" });
    expect(revealed.body.data.value).toMatch(/^\d+$/);
    expect(db.prepare(`SELECT 1 FROM audit_log WHERE action = 'application.revealed_id'`).get()).toBeTruthy();
  });

  it("shows staff the decrypted details, and downloads files with non-English names", async () => {
    const res = await submit(form({ applicantName: "রহিম উদ্দিন" }), { trade_license: PDF });
    expect(res.status).toBe(201);
    const id = (db.prepare(`SELECT id FROM applications WHERE reference = ?`).get(res.body.data.reference) as { id: number }).id;
    db.prepare(`UPDATE application_documents SET original_name = 'ট্রেড লাইসেন্স.pdf' WHERE application_id = ? AND kind = 'trade_license'`).run(id);
    const staff = await login("staff@test.bd");
    const detail = (await staff.get(`/api/v1/admin/applications/${id}`)).body.data;
    expect(detail.applicantName).toBe("রহিম উদ্দিন");
    const doc = detail.documents.find((d: { kind: string }) => d.kind === "trade_license");
    const download = await staff.get(`/api/v1/admin/applications/${id}/documents/${doc.id}`).buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toMatch(/filename\*=UTF-8''/);
  });

  it("never writes a mistyped password (typed into the email box) to the audit log", async () => {
    await request(app).post("/api/v1/auth/login").send({ email: "MySecretPassw0rd!", password: "x" });
    const rows = db.prepare(`SELECT details FROM audit_log WHERE action = 'login.failed'`).all() as { details: string }[];
    expect(rows.map((r) => r.details).join(" ")).not.toContain("MySecretPassw0rd!");
  });

  it("finds members by exact email although emails are stored encrypted", async () => {
    const staff = await login("staff@test.bd");
    const found = (await staff.get("/api/v1/admin/members?q=OWNER%40sister.test")).body.data as { company: string; email: string }[];
    expect(found.map((m) => m.company)).toContain("Bengal Renewable Energy Limited");
    expect(found[0].email).toBe("owner@sister.test");
  });

  it("keeps the audit log append-only", () => {
    expect(() => db.prepare(`UPDATE audit_log SET action = 'x'`).run()).toThrow(/append-only/);
    expect(() => db.prepare(`DELETE FROM audit_log`).run()).toThrow(/append-only/);
  });

  it("sends security headers and never lets answers be cached", async () => {
    const res = await request(app).get("/api/v1/verify/AAAAAAAAAAAAAAAAAAAAAAAA");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
