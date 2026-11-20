import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*--Runs the demo exactly as docs/demo-kit/README.md describes it, with the kit's own values and files,
  so the printed script stays true when the system changes. Also checks the reset between demos.--*/

const KIT = path.resolve(__dirname, "../../docs/demo-kit");
const values = JSON.parse(fs.readFileSync(path.join(KIT, "values.json"), "utf8")) as Record<"honest" | "copycat" | "lookalike", Record<string, string>>;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-demo-kit-"));
const PASSWORD = "Correct-Horse-42";
let app: Express;
let db: typeof import("../db/database").db;
let demo: typeof import("../services/demo");

// The form's upload fields, and which kit file goes in each
const FIELDS = {
  trade_license: "trade-licence.pdf",
  tax_acknowledgement: "tax-acknowledgement.pdf",
  bin_certificate: "bin-certificate.pdf",
  applicant_id: "applicant-nid.pdf",
  applicant_photo: "applicant-photo.png",
  payment_receipt: "payment-receipt.pdf",
};

const submit = (fields: Record<string, string>, folder: string, swap: Record<string, string> = {}) => {
  let req = request(app).post("/api/v1/applications");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (const [field, file] of Object.entries(FIELDS)) {
    const full = swap[field] ?? path.join(KIT, "files", folder, file);
    if (fs.existsSync(full)) req = req.attach(field, full);
  }
  return req;
};

const login = async (email: string) => {
  const agent = request.agent(app);
  expect((await agent.post("/api/v1/auth/login").send({ email, password: PASSWORD })).status).toBe(200);
  return agent;
};

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORAGE_DIR", dir);
  vi.stubEnv("DATABASE_FILE", ":memory:");
  vi.stubEnv("ENCRYPTION_KEY", "bb".repeat(32));
  vi.stubEnv("BLIND_INDEX_KEY", "cc".repeat(32));
  vi.stubEnv("PAYMENT_RECEIPT_REQUIRED", "0"); // as on the demo server
  app = (await import("../app")).default;
  db = (await import("../db/database")).db;
  demo = await import("../services/demo");
  const { hashPassword } = await import("../utils/security");
  for (const [email, role] of [["you@demo.test", "admin"], ["reviewer@demo.test", "staff"]])
    db.prepare(`INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, '2026-01-01')`).run(email, role, role, hashPassword(PASSWORD));
  demo.replaceWithDemoData(40);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the demo script", () => {
  let honestId: number;
  let lookalikeId: number;

  it("2. the honest company applies", async () => {
    const res = await submit(values.honest, "1-sunrise");
    expect(res.status).toBe(201);
    honestId = (db.prepare(`SELECT id FROM applications WHERE reference = ?`).get(res.body.data.reference) as { id: number }).id;
  });

  it("3a. the copycat with a differently written name is refused", async () => {
    expect((await submit(values.copycat, "1-sunrise")).status).toBe(409);
  });

  it("3b. fake.pdf as the trade licence is refused, then the real file is accepted and flagged", async () => {
    const fake = await submit(values.lookalike, "3-sunnrise", { trade_license: path.join(KIT, "files", "fake.pdf") });
    expect(fake.status).toBe(400);
    expect(fake.body.data.trade_license).toMatch(/Only PDF, JPG or PNG/);
    const res = await submit(values.lookalike, "3-sunnrise");
    expect(res.status).toBe(201);
    lookalikeId = (db.prepare(`SELECT id FROM applications WHERE reference = ?`).get(res.body.data.reference) as { id: number }).id;
  });

  it("4. staff see what matched and the missing receipt; Approve is not possible yet", async () => {
    const you = await login("you@demo.test");
    const detail = (await you.get(`/api/v1/admin/applications/${lookalikeId}`)).body.data;
    const fields = detail.duplicatesNow.map((m: { field: string }) => m.field);
    expect(fields).toEqual(expect.arrayContaining(["company", "phone"]));
    expect(detail.documents.some((d: { kind: string }) => d.kind === "payment_receipt")).toBe(false);
    expect(detail.applicantNid).toMatch(/^\*+/);
    expect((await you.post(`/api/v1/admin/applications/${lookalikeId}/approve`).send({})).status).toBe(409);
  });

  it("5. Reviewer confirms the honest company (and can't approve); you approve it", async () => {
    const you = await login("you@demo.test");
    const reviewer = await login("reviewer@demo.test");
    expect((await reviewer.post(`/api/v1/admin/applications/${honestId}/duplicates-checked`).send({ note: "Original company; the look-alike is checked separately" })).status).toBe(200);
    expect((await reviewer.post(`/api/v1/admin/applications/${honestId}/approve`).send({})).status).toBe(403);
    expect((await you.post(`/api/v1/admin/applications/${honestId}/approve`).send({})).status).toBe(200);
  });

  it("6. you confirm the look-alike yourself, can't approve it too, and reject it", async () => {
    const you = await login("you@demo.test");
    const detail = (await you.get(`/api/v1/admin/applications/${lookalikeId}`)).body.data;
    expect(detail.duplicatesNow.length).toBeGreaterThan(0); // still similar to the new member
    expect((await you.post(`/api/v1/admin/applications/${lookalikeId}/duplicates-checked`).send({ note: "Checking the two-person rule" })).status).toBe(200);
    const approve = await you.post(`/api/v1/admin/applications/${lookalikeId}/approve`).send({});
    expect(approve.status).toBe(409);
    expect(approve.body.message).toMatch(/Another person must approve/);
    expect((await you.post(`/api/v1/admin/applications/${lookalikeId}/reject`).send({ reason: "Look-alike of Demo Sunrise Solar Ltd; a fake file was uploaded" })).status).toBe(200);
  });

  it("7-9. the certificate checks as valid, a made-up code fails, and after revoking it shows revoked with a staff alert", async () => {
    const you = await login("you@demo.test");
    const cert = (await you.get("/api/v1/admin/certificates")).body.data[0];
    expect(cert.company).toBe("Demo Sunrise Solar Ltd");
    expect((await you.get(`/api/v1/admin/certificates/${cert.id}/pdf`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/verify/${cert.verifyCode}`)).body.data.status).toBe("valid");
    expect((await request(app).get(`/api/v1/verify/${"x".repeat(24)}`)).status).toBe(404);
    await you.post(`/api/v1/admin/certificates/${cert.id}/revoke`).send({ reason: "Demo: membership cancelled" });
    expect((await request(app).get(`/api/v1/verify/${cert.verifyCode}`)).body.data.status).toBe("revoked");
    expect((await you.get("/api/v1/admin/summary")).body.data.certificatesSuspiciousScans).toBe(1);
  });

  it("10. the audit log recorded it all", async () => {
    const you = await login("you@demo.test");
    const actions = new Set((await you.get("/api/v1/admin/audit-log")).body.data.map((a: { action: string }) => a.action));
    for (const action of ["application.submitted", "application.blocked_duplicate", "application.duplicates_checked", "application.approved", "application.rejected", "certificate.revoked"])
      expect(actions).toContain(action);
  });
});

describe("demo reset", () => {
  it("puts the demo back to the start, documents and all", () => {
    const docsDir = path.join(dir, "documents");
    expect(fs.readdirSync(docsDir).length).toBeGreaterThan(0);
    expect(demo.realCompanies()).toEqual([]);
    const deleted = demo.replaceWithDemoData(40);
    expect(deleted.applications).toBe(2);
    expect(deleted.certificates).toBe(1);
    expect(fs.readdirSync(docsDir)).toEqual([]);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM members`).get() as { n: number }).n).toBe(40);
  });

  it("notices real data, so the reset command refuses to run", () => {
    db.prepare(`INSERT INTO members (member_no, company, company_norm, source, joined_at, created_at) VALUES ('REAL-1', 'Real Company Ltd', 'realcompany', 'import', '2026-01-01', '2026-01-01')`).run();
    expect(demo.realCompanies()).toEqual(["Real Company Ltd"]);
  });
});
