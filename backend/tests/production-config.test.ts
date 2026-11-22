import { describe, expect, it } from "vitest";
import { productionProblems } from "../config/env.config";

/*--The API refuses to start on a production server that still has laptop settings--*/

const good = {
  NODE_ENV: "production",
  TRUST_PROXY: "1",
  CORS_ORIGINS: "https://bsreabd.org,https://admin.bsreabd.org",
  PUBLIC_SITE_URL: "https://bsreabd.org",
};

describe("production settings check", () => {
  it("passes a complete production .env", () => {
    expect(productionProblems(good)).toEqual([]);
  });

  it("allows http only for this machine (the staff panel through an SSH tunnel)", () => {
    expect(productionProblems({ ...good, CORS_ORIGINS: `${good.CORS_ORIGINS},http://localhost:8081` })).toEqual([]);
  });

  it("checks nothing outside production", () => {
    expect(productionProblems({ NODE_ENV: "development" })).toEqual([]);
    expect(productionProblems({})).toEqual([]);
  });

  it("requires TRUST_PROXY, so rate limits and lockouts see real visitor addresses", () => {
    expect(productionProblems({ ...good, TRUST_PROXY: undefined })).toHaveLength(1);
    expect(productionProblems({ ...good, TRUST_PROXY: "true" })).toHaveLength(1);
  });

  it("requires https website addresses, not the localhost defaults", () => {
    expect(productionProblems({ ...good, CORS_ORIGINS: undefined })).toHaveLength(1);
    expect(productionProblems({ ...good, CORS_ORIGINS: "http://localhost:3004" })).toHaveLength(1);
    expect(productionProblems({ ...good, CORS_ORIGINS: "https://bsreabd.org,http://evil.example" })).toHaveLength(1);
    expect(productionProblems({ ...good, PUBLIC_SITE_URL: undefined })).toHaveLength(1);
    expect(productionProblems({ ...good, PUBLIC_SITE_URL: "http://localhost:3004" })).toHaveLength(1);
  });
});
