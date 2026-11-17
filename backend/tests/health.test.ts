import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("GET /health", () => {
  it("answers ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
