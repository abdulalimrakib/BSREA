import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { hashPassword, setPassword, verifyPassword } from "../src/auth.ts";
import { buildPage, PAGES, percentileMs, RANGES, type RangeKey } from "../src/dashboard.ts";
import { createServer } from "../src/server.ts";

/*--Login, access control and the dashboard data--*/

const server = createServer();
let base = "";
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const login = (password: string, origin = base) =>
  fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin }, body: new URLSearchParams({ password }) });

describe("login", () => {
  it("stores passwords as scrypt hashes", () => {
    const stored = hashPassword("correct horse battery");
    assert.ok(!stored.includes("correct"));
    assert.equal(verifyPassword("correct horse battery", stored), true);
    assert.equal(verifyPassword("wrong", stored), false);
  });

  it("keeps everything but the login page behind the password", async () => {
    for (const path of ["/", "/index.html", "/app.js"]) {
      const res = await fetch(base + path, { redirect: "manual" });
      assert.equal(res.status, 303, path);
      assert.equal(res.headers.get("location"), "/login");
    }
    assert.equal((await fetch(`${base}/api/page/overview`)).status, 401);
    assert.equal((await fetch(`${base}/login`)).status, 200);
    assert.equal((await fetch(`${base}/style.css`)).status, 200);
    assert.equal(await (await fetch(`${base}/healthz`)).text(), "ok");
  });

  it("signs in with the right password only, from this site only", async () => {
    setPassword("a-long-test-password");
    assert.equal((await login("nope")).headers.get("location"), "/login?error=wrong");
    assert.equal((await login("a-long-test-password", "https://evil.example")).status, 403);
    const ok = await login("a-long-test-password");
    assert.equal(ok.headers.get("location"), "/");
    const cookie = ok.headers.get("set-cookie") ?? "";
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const session = cookie.split(";")[0];

    const res = await fetch(`${base}/api/page/overview?range=7d`, { headers: { Cookie: session } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-security-policy") ?? "", /script-src 'self'/);
    const body = await res.json();
    assert.equal(body.range.key, "7d");
    assert.ok(body.advice && !body.routes, "a page gets only its own numbers");
    // Each page address opens the app; unknown pages don't exist
    assert.equal((await fetch(`${base}/security`, { headers: { Cookie: session } })).status, 200);
    assert.equal((await fetch(`${base}/api/page/nope`, { headers: { Cookie: session } })).status, 404);
    assert.equal((await fetch(`${base}/api/page/overview?range=forever`, { headers: { Cookie: session } })).status, 400);
    // Files outside public/ can't be read
    assert.equal((await fetch(`${base}/..%2fsrc%2fconfig.ts`, { headers: { Cookie: session } })).status, 404);

    const out = await fetch(`${base}/logout`, { method: "POST", redirect: "manual", headers: { Cookie: session, Origin: base } });
    assert.equal(out.headers.get("location"), "/login");
    assert.equal((await fetch(`${base}/api/page/overview`, { headers: { Cookie: session } })).status, 401, "signed out");
  });

  it("accepts a sign-in the way real browsers send it, and refuses one from another site", async () => {
    const post = (headers: Record<string, string>) =>
      fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: "password=a-long-test-password" });
    // Chrome and Firefox: Origin can be "null" on a form post; Sec-Fetch-Site says where it really came from
    assert.equal((await post({ Origin: "null", "Sec-Fetch-Site": "same-origin" })).headers.get("location"), "/");
    assert.equal((await post({ Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await post({ Origin: "null", "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await post({ "Sec-Fetch-Site": "same-site" })).status, 403, "another subdomain is not this site");
  });

  it("locks out an address after 5 wrong passwords", async () => {
    const res = await Promise.all(Array.from({ length: 6 }, () => login("wrong-again")));
    assert.equal(res.at(-1)!.headers.get("location"), "/login?error=wait");
    assert.equal((await login("a-long-test-password")).headers.get("location"), "/login?error=wait", "even the right password waits");
  });
});

describe("dashboard data", () => {
  it("estimates response-time percentiles from buckets", () => {
    assert.equal(percentileMs([0, 0, 0, 0, 0, 0, 0], 0.95), null);
    assert.equal(percentileMs([10, 0, 0, 0, 0, 0, 0], 0.5), 25);
    assert.equal(percentileMs([90, 10, 0, 0, 0, 0, 0], 0.95), 75);
  });

  it("builds every page for every range, even with no data yet", () => {
    for (const key of Object.keys(RANGES) as RangeKey[])
      for (const page of PAGES) {
        const d = buildPage(page, key);
        assert.equal(d.page, page);
        assert.ok(Array.isArray(d.problems));
      }
  });
});
