import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*--The membership fee receipt is required, unless switched off for testing (PAYMENT_RECEIPT_REQUIRED=0)--*/

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-payment-"));
let app: Express;
let envConfig: typeof import("../config/env.config").default;
const PDF = Buffer.from("%PDF-1.4\n% test document\n");

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORAGE_DIR", dir);
  vi.stubEnv("DATABASE_FILE", ":memory:");
  vi.stubEnv("ENCRYPTION_KEY", "77".repeat(32));
  vi.stubEnv("BLIND_INDEX_KEY", "88".repeat(32));
  vi.stubEnv("PAYMENT_RECEIPT_REQUIRED", "");
  app = (await import("../app")).default;
  envConfig = (await import("../config/env.config")).default;
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

let n = 0;
const submitWithoutReceipt = () => {
  n++;
  const fields = {
    membershipType: "general", origin: "local", company: `Receipt Test ${n} Ltd`, tradeLicenseNo: `TRAD/${900000 + n}`,
    binNo: `00${7000000 + n}`, companyEmail: `info@r${n}.com`, companyPhone: `0171${2000000 + n}`, address: "Dhaka",
    applicantName: "A", applicantDesignation: "MD", applicantEmail: `md@r${n}.com`, applicantMobile: `0181${2000000 + n}`,
    applicantNid: `19${7000000000 + n}`, declaration: "yes",
  };
  let req = request(app).post("/api/v1/applications");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (const k of ["trade_license", "tax_acknowledgement", "bin_certificate", "applicant_id", "applicant_photo"])
    req = req.attach(k, Buffer.concat([PDF, Buffer.from(`${k}${n}`)]), `${k}.pdf`);
  return req;
};

describe("payment receipt", () => {
  it("is required by default", async () => {
    expect(envConfig.PAYMENT_RECEIPT_REQUIRED).toBe(true);
    const res = await submitWithoutReceipt();
    expect(res.status).toBe(400);
    expect(res.body.data.payment_receipt).toBeTruthy();
  });

  it("can be switched off for testing the process without paying", async () => {
    envConfig.PAYMENT_RECEIPT_REQUIRED = false;
    try {
      const res = await submitWithoutReceipt();
      expect(res.status).toBe(201);
    } finally {
      envConfig.PAYMENT_RECEIPT_REQUIRED = true;
    }
  });
});
