import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Save messages in a temporary folder, not the real storage folder
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-contact-"));
let app: Express;
let decryptText: (data: string) => string;

beforeAll(async () => {
  vi.stubEnv("STORAGE_DIR", dir);
  app = (await import("../app")).default;
  decryptText = (await import("../utils/security")).decryptText;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const saved = () => {
  const file = path.join(dir, "contact-messages.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(decryptText(JSON.parse(line).data)));
};

describe("POST /api/v1/contact", () => {
  it("saves a valid message", async () => {
    const res = await request(app)
      .post("/api/v1/contact")
      .send({ name: "Rahim", email: "rahim@example.com", phone: "+880 1711-000000", message: "Hello BSREA" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(saved()).toEqual([expect.objectContaining({ name: "Rahim", email: "rahim@example.com", message: "Hello BSREA" })]);
    // On disk the message is encrypted and private to this user
    const file = path.join(dir, "contact-messages.jsonl");
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).not.toContain("rahim@example.com");
    expect(raw).not.toContain("+880 1711-000000");
    expect(fs.statSync(file).mode & 0o077).toBe(0);
  });

  it("answers 400 with the field errors for bad input", async () => {
    const res = await request(app).post("/api/v1/contact").send({ name: "", email: "not-an-email", phone: "abc", message: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Object.keys(res.body.data).sort()).toEqual(["email", "message", "name", "phone"]);
  });

  it("quietly drops messages that fill the spam trap", async () => {
    const before = saved().length;
    const res = await request(app).post("/api/v1/contact").send({ name: "Bot", email: "bot@example.com", message: "spam", website: "http://spam" });
    expect(res.status).toBe(201);
    expect(saved().length).toBe(before);
  });
});
