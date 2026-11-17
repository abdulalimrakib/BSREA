import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

/*--Attack protection: detect, judge the effect on real visitors, block--*/

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-security-"));
process.env.BLOCKLIST_FILE = path.join(dir, "blocklist.map");
process.env.ALLOW_IPS = "198.51.100.200";
const { ingest, setObserver } = await import("../src/collect/nginx.ts");
const security = await import("../src/security.ts");
const { db } = await import("../src/db.ts");
type LogLine = import("../src/collect/nginx.ts").LogLine;

let reloads = 0;
let reloadFails = false;
security.setReloader(async () => {
  if (reloadFails) throw new Error("nginx: test failure");
  reloads++;
});
setObserver(security.observe);

const now = () => new Date().toISOString();
const line = (over: Partial<LogLine> = {}): LogLine => ({
  t: now(), h: "bsreabd.org", ip: "203.0.113.5", m: "GET", u: "/about", s: 200, b: 1000, rt: 0.12, ua: "Mozilla/5.0 Chrome/130", ...over,
});
const many = (n: number, over: Partial<LogLine>) => Array.from({ length: n }, () => line(over));
const blocklist = () => fs.readFileSync(process.env.BLOCKLIST_FILE!, "utf8");

beforeEach(() => {
  security.resetSecurity();
  db.exec(`DELETE FROM bans; DELETE FROM ban_log; DELETE FROM security_events; DELETE FROM check_state`);
  reloads = 0;
  reloadFails = false;
});

describe("attack protection", () => {
  it("does nothing on normal traffic", async () => {
    ingest([...many(40, {}), ...many(5, { ip: "198.51.100.7", u: "/news" })]);
    const result = await security.assess();
    assert.deepEqual(result.attacks, []);
    assert.equal(result.checks.find((c) => c.name === "security")!.detail, "No attack right now.");
    assert.equal(result.checks.find((c) => c.name === "visitors")!.ok, true);
    assert.equal(security.activeBans().length, 0);
  });

  it("blocks a scanner, and a blocked attack is not a warning", async () => {
    ingest([...many(30, {}), ...many(10, { ip: "192.0.2.66", u: "/.env", s: 404, ua: "Mozilla/5.0" }), ...many(10, { ip: "192.0.2.66", u: "/wp-login.php", s: 404 })]);
    const result = await security.assess();
    const bans = security.activeBans();
    assert.equal(bans.length, 1);
    assert.equal(bans[0].ip, "192.0.2.66");
    assert.match(bans[0].reason, /\.env or \.php/);
    assert.match(blocklist(), /^192\.0\.2\.66 192\.0\.2\.66;$/m);
    assert.equal(reloads, 1);
    const check = result.checks.find((c) => c.name === "security")!;
    assert.equal(check.ok, true, "blocked and visitors fine: no warning");
    assert.match(check.detail, /Attack blocked: .*Visitors are not affected/);
    // The history keeps the address masked
    assert.equal((db.prepare(`SELECT ip_masked FROM ban_log`).get() as { ip_masked: string }).ip_masked, "192.0.x.x");
  });

  it("blocks staff password guessing and floods", async () => {
    ingest(many(16, { ip: "192.0.2.77", m: "POST", u: "/api/v1/auth/login", s: 401 }));
    ingest(many(1600, { ip: "192.0.2.88", u: "/members" }));
    await security.assess();
    const reasons = Object.fromEntries(security.activeBans().map((b) => [b.ip, b.reason]));
    assert.match(reasons["192.0.2.77"], /Guessed staff passwords/);
    assert.match(reasons["192.0.2.88"], /Flooded the site/);
  });

  it("warns when an attack affects real visitors", async () => {
    ingest([...many(400, { ip: "192.0.2.99", u: "/.env", s: 404 }), ...many(20, { s: 502 }), ...many(20, {})]);
    const result = await security.assess();
    const check = result.checks.find((c) => c.name === "security")!;
    assert.equal(check.ok, false);
    assert.match(check.detail, /Under attack .* visitors are affected/);
    assert.equal(result.checks.find((c) => c.name === "visitors")!.ok, false);
    const episode = db.prepare(`SELECT affected FROM security_events`).get() as { affected: number };
    assert.equal(episode.affected, 1);
  });

  it("warns when real visitors can't use the site, attack or not", async () => {
    ingest([...many(15, { s: 503 }), ...many(5, {})]);
    const result = await security.assess();
    const visitors = result.checks.find((c) => c.name === "visitors")!;
    assert.equal(visitors.ok, false);
    assert.match(visitors.detail, /75% of visitors' requests fail/);
    assert.equal(result.checks.find((c) => c.name === "security")!.ok, true, "no attack: the security check stays quiet");
  });

  it("never acts on old log lines, private addresses or the allow list", async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    ingest(many(50, { ip: "192.0.2.10", u: "/.env", t: old }));
    ingest(many(50, { ip: "10.0.0.4", u: "/.env" }));
    ingest(many(50, { ip: "198.51.100.200", u: "/.env" }));
    await security.assess();
    assert.equal(security.activeBans().length, 0);
  });

  it("unblocks from the dashboard, and blocks repeat attackers for longer", async () => {
    ingest(many(10, { ip: "192.0.2.66", u: "/.env" }));
    await security.assess();
    const first = security.activeBans()[0];
    assert.equal(await security.unban("192.0.2.66"), true);
    assert.equal(security.activeBans().length, 0);
    assert.doesNotMatch(blocklist(), /192\.0\.2\.66/);
    security.resetSecurity();
    ingest(many(10, { ip: "192.0.2.66", u: "/.env" }));
    await security.assess();
    const second = security.activeBans()[0];
    assert.equal(second.strikes, 2);
    assert.ok(second.until - second.since > first.until - first.since, "longer the second time");
  });

  it("puts the old list back if nginx can't reload", async () => {
    ingest(many(10, { ip: "192.0.2.66", u: "/.env" }));
    await security.assess();
    const good = blocklist();
    reloadFails = true;
    security.resetSecurity();
    ingest(many(10, { ip: "192.0.2.67", u: "/.env" }));
    await security.assess();
    assert.equal(blocklist(), good);
  });
});
