import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*--Lockout, two-factor login, virus scanning, upload limits, backups and data retention--*/

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-security-"));
let app: Express;
let db: typeof import("../db/database").db;
let envConfig: typeof import("../config/env.config").default;
let totp: typeof import("../utils/totp");

const PASSWORD = "Correct-Horse-42";
const PDF = Buffer.from("%PDF-1.4\n% test document\n");
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORAGE_DIR", path.join(dir, "storage"));
  vi.stubEnv("DATABASE_FILE", ":memory:");
  vi.stubEnv("ENCRYPTION_KEY", "55".repeat(32));
  vi.stubEnv("BLIND_INDEX_KEY", "66".repeat(32));
  app = (await import("../app")).default;
  // Let tests pretend to come from different addresses
  app.set("trust proxy", true);
  db = (await import("../db/database")).db;
  envConfig = (await import("../config/env.config")).default;
  totp = await import("../utils/totp");
  const { hashPassword } = await import("../utils/security");
  for (const [email, role] of [
    ["admin@test.bd", "admin"],
    ["approver@test.bd", "approver"],
    ["victim@test.bd", "staff"],
    ["twofa@test.bd", "staff"],
  ]) {
    db.prepare(
      `INSERT INTO staff_users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, '2026-01-01')`,
    ).run(email, role, role, hashPassword(PASSWORD));
  }
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const loginFrom = (ip: string, body: Record<string, string>) =>
  request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ip).send(body);

const login = async (email: string) => {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return agent;
};

let counter = 0;
const submit = () => {
  counter++;
  const fields: Record<string, string> = {
    membershipType: "general",
    origin: "local",
    company: `Security Test Company ${counter} Ltd`,
    tradeLicenseNo: `TRAD/SEC/${200000 + counter}`,
    binNo: `00${7000000 + counter}`,
    companyEmail: `info${counter}@sectest${counter}.com`,
    companyPhone: `0171${String(2000000 + counter).slice(-7)}`,
    address: "House 1, Road 2, Gulshan, Dhaka",
    applicantName: "Test Applicant",
    applicantDesignation: "Managing Director",
    applicantEmail: `md${counter}@sectest${counter}.com`,
    applicantMobile: `0181${String(2000000 + counter).slice(-7)}`,
    applicantNid: `19${String(9000000000 + counter)}`,
    declaration: "yes",
  };
  let req = request(app).post("/api/v1/applications");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  const docs = {
    trade_license: PDF,
    tax_acknowledgement: PDF,
    bin_certificate: PDF,
    applicant_id: PDF,
    applicant_photo: PNG,
    payment_receipt: PDF,
  };
  for (const [k, v] of Object.entries(docs))
    req = req.attach(
      k,
      Buffer.concat([v, Buffer.from(`${k}-${counter}-${Math.random()}`)]),
      `${k}.${v === PNG ? "png" : "pdf"}`,
    );
  return req;
};

describe("login lockout", () => {
  it("locks only the guessing address, so an attacker can't lock real staff out", async () => {
    for (let i = 0; i < 5; i++)
      await loginFrom("203.0.113.9", {
        email: "victim@test.bd",
        password: "wrong",
      });
    expect(
      (
        await loginFrom("203.0.113.9", {
          email: "victim@test.bd",
          password: PASSWORD,
        })
      ).status,
    ).toBe(423);
    // The real staff member, from their own address, still gets in
    expect(
      (
        await loginFrom("198.51.100.7", {
          email: "victim@test.bd",
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
  });
});

describe("two-factor login", () => {
  it("computes the standard RFC 6238 codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
    expect(totp.totpCode(secret, totp.currentStep(59_000))).toBe("287082");
    expect(totp.totpCode(secret, totp.currentStep(1_111_111_109_000))).toBe(
      "081804",
    );
    expect(totp.verifyTotp(secret, "081804", null, 1_111_111_109_000)).toBe(
      totp.currentStep(1_111_111_109_000),
    );
    expect(
      totp.verifyTotp(secret, "000000", null, 1_111_111_109_000),
    ).toBeNull();
  });

  it("sets up with the password and a first code, then asks for a code at every login, once per code", async () => {
    const agent = await login("twofa@test.bd");
    await agent
      .post("/api/v1/auth/two-factor/setup")
      .send({ password: "wrong" })
      .expect(400);
    const setup = await agent
      .post("/api/v1/auth/two-factor/setup")
      .send({ password: PASSWORD })
      .expect(200);
    expect(setup.body.data.qr).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.data.secret as string;

    // The secret is stored encrypted
    const row = db
      .prepare(
        `SELECT totp_secret_enc FROM staff_users WHERE email = 'twofa@test.bd'`,
      )
      .get() as { totp_secret_enc: string };
    expect(row.totp_secret_enc).not.toContain(secret);

    await agent
      .post("/api/v1/auth/two-factor/enable")
      .send({ code: "123456" })
      .expect(400);
    await agent
      .post("/api/v1/auth/two-factor/enable")
      .send({ code: totp.totpCode(secret, totp.currentStep()) })
      .expect(200);

    // Password alone is no longer enough
    const noCode = await loginFrom("192.0.2.1", {
      email: "twofa@test.bd",
      password: PASSWORD,
    });
    expect(noCode.status).toBe(401);
    expect(noCode.body.data).toEqual({ twoFactorRequired: true });
    expect(noCode.headers["set-cookie"]).toBeUndefined();

    // The code used to switch it on can't be used again; the next one works, once
    db.prepare(
      `UPDATE staff_users SET totp_last_step = ? WHERE email = 'twofa@test.bd'`,
    ).run(totp.currentStep() - 2);
    const code = totp.totpCode(secret, totp.currentStep() + 1);
    expect(
      (
        await loginFrom("192.0.2.1", {
          email: "twofa@test.bd",
          password: PASSWORD,
          code,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await loginFrom("192.0.2.1", {
          email: "twofa@test.bd",
          password: PASSWORD,
          code,
        })
      ).status,
    ).toBe(401);
  });

  it("when required, lets staff without it do nothing but set it up", async () => {
    const agent = await login("approver@test.bd");
    envConfig.REQUIRE_TWO_FACTOR = true;
    try {
      const blocked = await agent.get("/api/v1/admin/applications");
      expect(blocked.status).toBe(403);
      expect(blocked.body.data).toEqual({ code: "two_factor_setup_required" });
      expect((await agent.get("/api/v1/auth/me")).body.data).toMatchObject({
        twoFactor: false,
        twoFactorRequired: true,
      });
      await agent
        .post("/api/v1/auth/two-factor/setup")
        .send({ password: PASSWORD })
        .expect(200);
    } finally {
      envConfig.REQUIRE_TWO_FACTOR = false;
    }
  });

  it("can be reset by an admin (lost phone), which logs that person out", async () => {
    const admin = await login("admin@test.bd");
    const user = db
      .prepare(`SELECT id FROM staff_users WHERE email = 'twofa@test.bd'`)
      .get() as { id: number };
    await admin
      .post(`/api/v1/admin/staff/${user.id}/reset-two-factor`)
      .send({})
      .expect(200);
    expect(
      db
        .prepare(`SELECT totp_enabled FROM staff_users WHERE id = ?`)
        .get(user.id),
    ).toEqual({ totp_enabled: 0 });
    expect(
      db
        .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?`)
        .get(user.id),
    ).toEqual({ n: 0 });
  });
});

describe("virus scanning", () => {
  // A stand-in for clamd: reports "infected" for anything containing the word EICAR
  const fakeClamd = () =>
    new Promise<net.Server>((resolve) => {
      const server = net.createServer((socket) => {
        const chunks: Buffer[] = [];
        socket.on("data", (c) => {
          chunks.push(c);
          const all = Buffer.concat(chunks);
          if (all.subarray(-4).equals(Buffer.alloc(4)))
            socket.end(
              all.includes("EICAR")
                ? "stream: Eicar-Test-Signature FOUND\0"
                : "stream: OK\0",
            );
        });
      });
      server.listen(0, "127.0.0.1", () => resolve(server));
    });

  it("refuses an infected upload, and refuses all uploads if the scanner is down", async () => {
    const server = await fakeClamd();
    const { scanBuffer } = await import("../services/virus-scan");
    const port = (server.address() as net.AddressInfo).port;
    expect(await scanBuffer(PDF, "127.0.0.1", port)).toEqual({ clean: true });
    expect(
      await scanBuffer(
        Buffer.concat([PDF, Buffer.from("EICAR")]),
        "127.0.0.1",
        port,
      ),
    ).toEqual({ clean: false, virus: "Eicar-Test-Signature" });

    envConfig.CLAMAV_HOST = "127.0.0.1";
    envConfig.CLAMAV_PORT = port;
    try {
      expect((await submit()).status).toBe(201);
      server.close();
      expect((await submit()).status).toBe(503);
    } finally {
      envConfig.CLAMAV_HOST = "";
      server.close();
    }
  });
});

describe("upload limits", () => {
  it("handles only a few uploads at the same time and asks the rest to retry", async () => {
    const { parseApplicationUpload, MAX_PARALLEL_UPLOADS } =
      await import("../middleware/upload");
    const { EventEmitter } = await import("events");
    // Requests that never finish uploading, to hold their places
    const held = Array.from({ length: MAX_PARALLEL_UPLOADS }, () => {
      const res = Object.assign(new EventEmitter(), {
        setHeader: () => undefined,
        status: () => res,
        json: () => res,
      });
      const req = Object.assign(new EventEmitter(), {
        headers: {},
        pipe: () => undefined,
        unpipe: () => undefined,
        resume: () => undefined,
      });
      parseApplicationUpload(req as never, res as never, () => undefined);
      return res;
    });
    expect((await submit()).status).toBe(503);
    held.forEach((res) => res.emit("close"));
    expect((await submit()).status).toBe(201);
  });
});

describe("backups", () => {
  it("makes an encrypted backup that can be verified and restored, and notices damage", async () => {
    const backup = await import("../services/backup");
    const storage = envConfig.STORAGE_DIR;
    const backups = path.join(dir, "backups");
    const folder = backup.createBackup(db, storage, backups);

    expect(fs.statSync(folder).mode & 0o777).toBe(0o700);
    const dbEnc = fs.readFileSync(path.join(folder, "database.enc"));
    expect(dbEnc.includes(Buffer.from("SQLite format"))).toBe(false); // not readable without the key
    expect(dbEnc.includes(Buffer.from("admin@test.bd"))).toBe(false);

    const report = backup.verifyBackup(folder, storage);
    expect(report.ok).toBe(true);
    expect(report.counts.staff_users).toBe(4);
    expect(report.counts.application_documents).toBeGreaterThan(0);

    const target = path.join(dir, "restored", "bsrea.db");
    const restored = backup.restoreBackup(
      folder,
      target,
      path.join(dir, "restored"),
    );
    expect(restored.counts.applications).toBe(report.counts.applications);
    expect(fs.statSync(target).mode & 0o777).toBe(0o600);

    // Damage one document: the check must fail
    const doc = fs.readdirSync(path.join(folder, "documents"))[0];
    fs.appendFileSync(path.join(folder, "documents", doc), "x");
    expect(backup.verifyBackup(folder, storage).problems).toEqual([
      `changed or damaged: ${path.join("documents", doc)}`,
    ]);

    // Keeps only the newest ones
    fs.renameSync(folder, path.join(backups, "bsrea-20200101-000000"));
    backup.createBackup(db, storage, backups);
    expect(backup.pruneBackups(1, backups)).toEqual(["bsrea-20200101-000000"]);
  });
});

describe("data retention", () => {
  it("deletes rejected applications' documents after the retention period, and logs it", async () => {
    const { purgeExpired } = await import("../services/retention");
    const res = await submit();
    expect(res.status).toBe(201);
    const app1 = db
      .prepare(`SELECT id FROM applications WHERE reference = ?`)
      .get(res.body.data.reference) as { id: number };
    const approver = await login("approver@test.bd");
    await approver
      .post(`/api/v1/admin/applications/${app1.id}/reject`)
      .send({ reason: "Incomplete documents provided" })
      .expect(200);

    const files = (
      db
        .prepare(
          `SELECT storage_name FROM application_documents WHERE application_id = ?`,
        )
        .all(app1.id) as { storage_name: string }[]
    ).map((d) => path.join(envConfig.STORAGE_DIR, "documents", d.storage_name));
    expect(files.length).toBe(6);

    // Not yet: the decision is recent
    expect(purgeExpired(db).applications).toBe(0);

    const later = Date.now() + (envConfig.RETENTION_DAYS + 1) * 86_400_000;
    expect(purgeExpired(db, { dryRun: true, time: later })).toMatchObject({
      applications: 1,
      documents: 6,
    });
    expect(files.every((f) => fs.existsSync(f))).toBe(true);

    expect(purgeExpired(db, { time: later })).toMatchObject({
      applications: 1,
      documents: 6,
    });
    expect(files.some((f) => fs.existsSync(f))).toBe(false);
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM application_documents WHERE application_id = ?`,
        )
        .get(app1.id),
    ).toEqual({ n: 0 });
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'retention.documents_deleted' AND target_id = ?`,
        )
        .get(String(app1.id)),
    ).toEqual({ n: 1 });
    // Nothing left to do the second time
    expect(purgeExpired(db, { time: later }).applications).toBe(0);
  });
});
