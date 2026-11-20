import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*--Certificate checks: the verify page shows what to compare, every check is recorded, and staff are warned
  when a revoked or expired certificate is still being checked--*/

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-scans-"));
let app: Express;
let db: typeof import("../db/database").db;
let certs: typeof import("../services/certificates");
const PASSWORD = "Correct-Horse-42";
let certId: number;
let code: string;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORAGE_DIR", dir);
  vi.stubEnv("DATABASE_FILE", ":memory:");
  vi.stubEnv("ENCRYPTION_KEY", "99".repeat(32));
  vi.stubEnv("BLIND_INDEX_KEY", "aa".repeat(32));
  vi.stubEnv("PUBLIC_SITE_URL", "https://bsrea-demo.duckdns.org");
  app = (await import("../app")).default;
  db = (await import("../db/database")).db;
  certs = await import("../services/certificates");
  const { hashPassword } = await import("../utils/security");
  db.prepare(`INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES ('appr@t.bd', 'Approver', 'approver', ?, '2026-01-01')`).run(hashPassword(PASSWORD));
  const member = db
    .prepare(`INSERT INTO members (member_no, company, company_norm, source, joined_at, created_at) VALUES ('BSREA-M-2026-0007', 'Sun Rays Energy Ltd', 'sunraysenergy', 'import', '2026-01-01', '2026-01-01')`)
    .run();
  certId = certs.issueMembershipCertificate(Number(member.lastInsertRowid), null);
  code = (db.prepare(`SELECT verify_code FROM certificates WHERE id = ?`).get(certId) as { verify_code: string }).verify_code;
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const approver = async () => {
  const agent = request.agent(app);
  expect((await agent.post("/api/v1/auth/login").send({ email: "appr@t.bd", password: PASSWORD })).status).toBe(200);
  return agent;
};

describe("certificate checks", () => {
  it("prints the official verify address taken from PUBLIC_SITE_URL", async () => {
    expect(certs.officialVerifyAddress()).toBe("bsrea-demo.duckdns.org/verify");
    expect(certs.verifyUrl(code)).toBe(`https://bsrea-demo.duckdns.org/verify/${code}`);
    const pdf = await certs.certificatePdf(db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(certId) as never);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("shows the member number and records the check with a shortened IP address", async () => {
    const res = await request(app).get(`/api/v1/verify/${code}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ memberNo: "BSREA-M-2026-0007", company: "Sun Rays Energy Ltd", status: "valid" });
    const scans = db.prepare(`SELECT state, ip_masked FROM certificate_scans WHERE certificate_id = ?`).all(certId) as { state: string; ip_masked: string }[];
    expect(scans).toHaveLength(1);
    expect(scans[0].state).toBe("valid");
    expect(scans[0].ip_masked).toMatch(/\.x$|:x$/);
  });

  it("does not record anything for a made-up code", async () => {
    const before = (db.prepare(`SELECT COUNT(*) AS n FROM certificate_scans`).get() as { n: number }).n;
    expect((await request(app).get(`/api/v1/verify/${"Z".repeat(24)}`)).status).toBe(404);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM certificate_scans`).get() as { n: number }).n).toBe(before);
  });

  it("warns staff when a revoked certificate is still being checked", async () => {
    const staff = await approver();
    expect((await staff.get("/api/v1/admin/summary")).body.data.certificatesSuspiciousScans).toBe(0);

    await staff.post(`/api/v1/admin/certificates/${certId}/revoke`).send({ reason: "Membership cancelled" });
    const res = await request(app).get(`/api/v1/verify/${code}`);
    expect(res.body.data.status).toBe("revoked");

    expect((await staff.get("/api/v1/admin/summary")).body.data.certificatesSuspiciousScans).toBe(1);
    const row = (await staff.get("/api/v1/admin/certificates")).body.data.find((c: { id: number }) => c.id === certId);
    expect(row).toMatchObject({ scans: 2, suspicious_scans: 1 });
    expect(row.last_suspicious_at).toBeTruthy();
  });

  it("deletes checks older than a year", async () => {
    const { purgeExpired } = await import("../services/retention");
    const inTwoYears = Date.now() + 2 * 365 * 86_400_000;
    expect(purgeExpired(db, { dryRun: true, time: inTwoYears }).certificateScans).toBe(2);
    purgeExpired(db, { time: inTwoYears });
    expect((db.prepare(`SELECT COUNT(*) AS n FROM certificate_scans`).get() as { n: number }).n).toBe(0);
  });
});

describe("maskIp", () => {
  it("keeps the area, not the person", async () => {
    const { maskIp } = await import("../utils/security");
    expect(maskIp("203.0.113.45")).toBe("203.0.113.x");
    expect(maskIp("::ffff:203.0.113.45")).toBe("203.0.113.x");
    expect(maskIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:85a3:x");
  });
});
