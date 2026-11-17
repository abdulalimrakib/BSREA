import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { db } from "../src/db.ts";
import { ingest, isPageView, kindOf, readNewLines, routeOf, type LogLine } from "../src/collect/nginx.ts";
import { checkBackup } from "../src/collect/checks.ts";
import { describe as describeAlert, recordChecks } from "../src/alerts.ts";

/*--Reading the nginx log, checks and alerts--*/

const line = (over: Partial<LogLine> = {}): LogLine => ({
  t: "2026-03-10T05:00:10+00:00", h: "bsreabd.org", ip: "203.0.113.5", m: "GET", u: "/about", s: 200, b: 1000, rt: 0.12,
  ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/130", ...over,
});
const rows = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).all(...p) as Record<string, unknown>[]).map((r) => ({ ...r }));

describe("nginx log", () => {
  it("tells pages, API calls and files apart", () => {
    assert.equal(kindOf("/members?page=2"), "page");
    assert.equal(kindOf("/api/v1/contact"), "api");
    assert.equal(kindOf("/_next/static/chunk.js"), "asset");
    assert.equal(kindOf("/uploads/2024/logo.png"), "asset");
  });

  it("counts only real page views", () => {
    assert.equal(isPageView(line()), true);
    assert.equal(isPageView(line({ ua: "Googlebot/2.1" })), false);
    assert.equal(isPageView(line({ s: 404 })), false);
    assert.equal(isPageView(line({ m: "POST" })), false);
    assert.equal(isPageView(line({ u: "/news?_rsc=1", rsc: "1", pf: "1" })), false, "prefetch");
    assert.equal(isPageView(line({ u: "/news?_rsc=1", rsc: "1" })), true, "in-app page change");
  });

  it("stores API routes as patterns, never IDs or certificate numbers", () => {
    assert.equal(routeOf("/api/v1/verify/BSREA-2026-0412?x=1"), "/api/v1/verify/:id");
    assert.equal(routeOf("/api/v1/admin/applications/17"), "/api/v1/admin/applications/:id");
    assert.equal(routeOf("/api/v1/admin/certificates/22/pdf"), "/api/v1/admin/certificates/:id/pdf");
    assert.equal(routeOf("/api/v1/admin/summary"), "/api/v1/admin/summary");
  });

  it("adds up traffic, visitors and pages without storing addresses", () => {
    ingest([
      line(),
      line({ u: "/about/", rt: 0.4 }),
      line({ ip: "198.51.100.7", u: "/" }),
      line({ ua: "bingbot", u: "/" }),
      line({ u: "/api/v1/verify/BSREA-1234", s: 500, rt: 1.2 }),
      line({ u: "/_next/static/a.js", rt: 0.002 }),
    ]);
    const [page] = rows(`SELECT * FROM traffic_min WHERE kind = 'page'`);
    assert.equal(page.requests, 4);
    assert.equal(page.views, 3);
    assert.equal(page.bots, 1);
    assert.equal(rows(`SELECT visitors FROM visitors_day`)[0].visitors, 2);
    assert.deepEqual(rows(`SELECT path, views FROM pages_day ORDER BY views DESC LIMIT 1`)[0], { path: "/about", views: 2 });
    assert.deepEqual(rows(`SELECT route, errors FROM routes_day`), [{ route: "/api/v1/verify/:id", errors: 1 }]);
    // The hourly table gets the same totals
    assert.equal(rows(`SELECT SUM(requests) AS n FROM traffic_hour`)[0].n, 6);
    const everything = JSON.stringify(["traffic_min", "visitor_seen", "pages_day", "routes_day"].map((t) => rows(`SELECT * FROM ${t}`)));
    assert.ok(!everything.includes("203.0.113") && !everything.includes("198.51.100") && !everything.includes("1234"));
  });

  it("follows the log through logrotate without losing or repeating lines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-log-"));
    const log = path.join(dir, "access.log");
    const write = (file: string, n: number, extra = "") => fs.appendFileSync(file, Array.from({ length: n }, () => JSON.stringify(line({ h: "rotate.test" }))).join("\n") + "\n" + extra);
    const count = () => Number(rows(`SELECT COALESCE(SUM(requests), 0) AS n FROM traffic_min WHERE host = 'rotate.test'`)[0].n);

    write(log, 3, '{"t":"half a li'); // a line still being written is left for next time
    assert.equal(readNewLines(log).read, 3);
    assert.equal(readNewLines(log).read, 0, "nothing new");
    fs.appendFileSync(log, 'ne"}\n');
    write(log, 2);
    fs.renameSync(log, `${log}.1`); // logrotate
    write(log, 4);
    readNewLines(log);
    assert.equal(count(), 9);
    assert.equal(readNewLines(log).problem, undefined);
    assert.match(readNewLines(path.join(dir, "missing.log")).problem ?? "", /not found/);
  });
});

describe("checks and alerts", () => {
  it("alerts when a check breaks, reminds while broken, and when it is fixed", () => {
    const t0 = 1_800_000_000;
    const at = (minutes: number) => t0 + minutes * 60;
    const check = (ok: boolean) => [{ name: "site", label: "Public website", ok, detail: ok ? "Working" : "Down", hint: "pm2 status" }];
    assert.deepEqual(recordChecks(check(true), at(0)), []);
    assert.deepEqual(recordChecks(check(false), at(5)).map((c) => c.change), ["broken"]);
    assert.deepEqual(recordChecks(check(false), at(10)), [], "no repeat every 5 minutes");
    assert.deepEqual(recordChecks(check(false), at(5 + 6 * 60)).map((c) => c.change), ["still broken"]);
    const fixed = recordChecks(check(true), at(400));
    assert.deepEqual(fixed.map((c) => c.change), ["fixed"]);
    assert.equal(describeAlert(fixed).title, "BSREA: back to normal");
  });

  it("checks that last night's backup exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsrea-backup-"));
    assert.equal(checkBackup(dir).ok, false);
    const folder = path.join(dir, "bsrea-20260310-021500");
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "manifest.json"), "{}");
    assert.equal(checkBackup(dir).ok, true);
    const old = new Date(Date.now() - 30 * 3_600_000);
    fs.utimesSync(folder, old, old);
    assert.equal(checkBackup(dir).detail, "Last backup 30 hours ago");
  });
});
