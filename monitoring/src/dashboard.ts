import { config } from "./config.ts";
import { BUCKET_LIMITS_MS, db } from "./db.ts";
import { applicationsPerDay, readBusiness } from "./collect/business.ts";
import { status as collectorStatus } from "./collector.ts";
import { dayKey, dayStart, nowSec, tzOffsetSec } from "./time.ts";

/*--Everything the dashboard page shows, for one time range. Each page takes its part (buildPage, GET /api/page/<page>?range=24h).
  Charts get a shared time axis with one value per step; a step with no data is null (a gap), not 0.--*/

export const RANGES = {
  "1h": { seconds: 3600, step: 60, label: "Last hour" },
  "24h": { seconds: 86400, step: 900, label: "Last 24 hours" },
  "7d": { seconds: 7 * 86400, step: 3600, label: "Last 7 days" },
  "30d": { seconds: 30 * 86400, step: 86400, label: "Last 30 days" },
  "90d": { seconds: 90 * 86400, step: 86400, label: "Last 90 days" },
  "1y": { seconds: 365 * 86400, step: 86400, label: "Last 12 months" },
} as const;
export type RangeKey = keyof typeof RANGES;

export type Level = "act" | "watch" | "ok";
export type Advice = { level: Level; area: string; finding: string; action?: string };

type Row = Record<string, number | string | null>;
const all = (sql: string, ...params: (string | number)[]) => db.prepare(sql).all(...params) as Row[];
const one = (sql: string, ...params: (string | number)[]) => db.prepare(sql).get(...params) as Row | undefined;

/*--Percentile from response-time bucket counts, interpolated inside the bucket--*/
const EDGES = [0, ...BUCKET_LIMITS_MS, 5000];
export const percentileMs = (buckets: number[], p: number) => {
  const total = buckets.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const target = p * total;
  let seen = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (seen + buckets[i] >= target && buckets[i] > 0) {
      const within = (target - seen) / buckets[i];
      return Math.round(EDGES[i] + within * (EDGES[i + 1] - EDGES[i]));
    }
    seen += buckets[i];
  }
  return EDGES.at(-1)!;
};

const quantile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
};

const isAdminHost = (host: string) => {
  try {
    if (host === new URL(config.ADMIN_URL).hostname) return true;
  } catch {
    // not a full URL
  }
  return host.startsWith("admin.");
};

export const buildDashboard = (rangeKey: RangeKey, now = nowSec()) => {
  const range = RANGES[rangeKey];
  const { step } = range;
  const offset = tzOffsetSec(new Date(now * 1000));
  // Buckets line up with local midnight, so a "day" bar is a Bangladesh day
  const bucket = (sec: number) => Math.floor((sec + offset) / step) * step - offset;
  const from = bucket(now - range.seconds) + step;
  const t: number[] = [];
  for (let s = from; s <= now; s += step) t.push(s);
  const index = new Map(t.map((s, i) => [s, i]));
  const blank = () => t.map(() => null as number | null);
  // Short ranges read the per-minute tables, long ones the hourly totals
  const fine = range.seconds <= 7 * 86400 && step < 3600;
  const traffic = fine ? "traffic_min" : "traffic_hour";
  const system = fine ? "system_min" : "system_hour";
  const groupBy = `((ts + ${offset}) / ${step}) * ${step} - ${offset}`;
  const fromDay = dayKey(from);
  const previousFrom = from - range.seconds;

  /*--Traffic: page views per site, requests, errors, speed--*/
  const views = { site: blank(), admin: blank() };
  const errors = { s4: blank(), s5: blank() };
  const requests = blank();
  const latency = { page: blank(), api: blank() };
  const totals = { views: 0, requests: 0, s5: 0, s4: 0, bots: 0, bytes: 0, probes: 0, loginFails: 0, limited: 0 };
  const sec = { real: blank(), bots: blank(), limited: blank(), probes: blank(), loginFails: blank() };
  const latencyAll = { page: [0, 0, 0, 0, 0, 0, 0], api: [0, 0, 0, 0, 0, 0, 0] };
  const rows = all(`
    SELECT ${groupBy} AS b, host, kind, SUM(requests) AS requests, SUM(views) AS views, SUM(bots) AS bots, SUM(s4) AS s4, SUM(s5) AS s5,
      SUM(bytes) AS bytes, SUM(b0) AS b0, SUM(b1) AS b1, SUM(b2) AS b2, SUM(b3) AS b3, SUM(b4) AS b4, SUM(b5) AS b5, SUM(b6) AS b6,
      SUM(probes) AS probes, SUM(login_fails) AS login_fails, SUM(limited) AS limited
    FROM ${traffic} WHERE ts >= ? GROUP BY b, host, kind`, from);
  const latencyBuckets = new Map<string, number[]>();
  for (const r of rows) {
    const i = index.get(r.b as number);
    if (i === undefined) continue;
    const admin = isAdminHost(r.host as string);
    const n = (k: string) => Number(r[k]) || 0;
    const v = admin ? views.admin : views.site;
    v[i] = (v[i] ?? 0) + n("views");
    totals.views += n("views");
    totals.bots += n("bots");
    totals.bytes += n("bytes");
    totals.probes += n("probes");
    totals.loginFails += n("login_fails");
    totals.limited += n("limited");
    // Security chart: people vs bots vs refused, and attack attempts (all requests, files included)
    const add = (series: (number | null)[], value: number) => (series[i] = (series[i] ?? 0) + value);
    add(sec.real, Math.max(0, n("requests") - n("bots") - n("probes") - n("limited")));
    add(sec.bots, Math.max(0, n("bots") + n("probes")));
    add(sec.limited, n("limited"));
    add(sec.probes, n("probes"));
    add(sec.loginFails, n("login_fails"));
    if (r.kind !== "asset") {
      requests[i] = (requests[i] ?? 0) + n("requests");
      totals.requests += n("requests");
      errors.s4[i] = (errors.s4[i] ?? 0) + n("s4");
      errors.s5[i] = (errors.s5[i] ?? 0) + n("s5");
      totals.s4 += n("s4");
      totals.s5 += n("s5");
    }
    if (r.kind === "page" || r.kind === "api") {
      const key = `${i}|${r.kind}`;
      const b = latencyBuckets.get(key) ?? [0, 0, 0, 0, 0, 0, 0];
      ["b0", "b1", "b2", "b3", "b4", "b5", "b6"].forEach((c, j) => {
        b[j] += n(c);
        latencyAll[r.kind as "page" | "api"][j] += n(c);
      });
      latencyBuckets.set(key, b);
    }
  }
  for (const [key, b] of latencyBuckets) {
    const [i, kind] = key.split("|");
    latency[kind as "page" | "api"][Number(i)] = percentileMs(b, 0.95);
  }
  // Steps with no traffic at all are real zeros (nginx logged nothing), once logging has started
  const firstTraffic = (one(`SELECT MIN(ts) AS t FROM traffic_hour`)?.t as number | null) ?? null;
  for (const series of [views.site, views.admin, requests, errors.s4, errors.s5, ...Object.values(sec)])
    t.forEach((s, i) => {
      if (series[i] === null && firstTraffic !== null && s + step > firstTraffic) series[i] = 0;
    });

  const previousViews = Number(one(`SELECT COALESCE(SUM(views), 0) AS v FROM traffic_hour WHERE ts >= ? AND ts < ?`, previousFrom, from)?.v) || 0;
  const visitorsByDay = all(`SELECT day, SUM(visitors) AS visitors FROM visitors_day WHERE day >= ? GROUP BY day ORDER BY day`, fromDay);
  const visitorsTotal = visitorsByDay.reduce((sum, r) => sum + Number(r.visitors), 0);
  const today = dayKey(now);
  const visitorsToday = Number(visitorsByDay.find((r) => r.day === today)?.visitors) || 0;

  /*--Daily views and visitors, for the bar chart (last 30 days, or the range if longer)--*/
  const dailyFrom = dayKey(Math.min(from, now - 29 * 86400));
  const dailyViews = all(`SELECT ((ts + ${offset}) / 86400) * 86400 - ${offset} AS d, SUM(views) AS views FROM traffic_hour WHERE ts >= ? GROUP BY d`, dayStart(now - Math.max(range.seconds, 30 * 86400) + 86400));
  const dailyVisitors = all(`SELECT day, SUM(visitors) AS visitors FROM visitors_day WHERE day >= ? GROUP BY day`, dailyFrom);
  const daily: { day: string; views: number; visitors: number }[] = [];
  for (let d = dayStart(now - Math.max(range.seconds, 30 * 86400) + 86400); d <= now; d += 86400) {
    const day = dayKey(d + 3600);
    daily.push({
      day,
      views: Number(dailyViews.find((r) => Number(r.d) === d)?.views) || 0,
      visitors: Number(dailyVisitors.find((r) => r.day === day)?.visitors) || 0,
    });
  }

  /*--Most viewed pages and the API's routes--*/
  const topPages = all(`SELECT host, path, SUM(views) AS views FROM pages_day WHERE day >= ? GROUP BY host, path ORDER BY views DESC LIMIT 12`, fromDay)
    .map((r) => ({ site: isAdminHost(r.host as string) ? "Staff panel" : "Website", path: r.path as string, views: Number(r.views) }));
  const routes = all(`
    SELECT method, route, SUM(requests) AS requests, SUM(errors) AS errors, SUM(lat_sum) AS lat_sum,
      SUM(b0) AS b0, SUM(b1) AS b1, SUM(b2) AS b2, SUM(b3) AS b3, SUM(b4) AS b4, SUM(b5) AS b5, SUM(b6) AS b6
    FROM routes_day WHERE day >= ? GROUP BY method, route ORDER BY requests DESC LIMIT 40`, fromDay).map((r) => ({
    route: `${r.method} ${r.route}`,
    requests: Number(r.requests),
    errors: Number(r.errors),
    avgMs: Math.round(Number(r.lat_sum) / Number(r.requests)),
    p95Ms: percentileMs(["b0", "b1", "b2", "b3", "b4", "b5", "b6"].map((c) => Number(r[c])), 0.95),
  }));

  /*--Server--*/
  const sys = { cpu: blank(), mem: blank(), swap: blank(), rx: blank(), tx: blank() };
  const sysRows = all(`
    SELECT ${groupBy} AS b, SUM(cpu_sum) / SUM(n) AS cpu, MAX(cpu_max) AS cpu_max, SUM(mem_used_sum) / SUM(n) AS mem_used, MAX(mem_total) AS mem_total,
      MAX(swap_used_max) AS swap, MAX(swap_total) AS swap_total, SUM(net_rx) AS rx, SUM(net_tx) AS tx
    FROM ${system} WHERE ts >= ? GROUP BY b`, from);
  for (const r of sysRows) {
    const i = index.get(r.b as number);
    if (i === undefined) continue;
    sys.cpu[i] = Math.round(Number(r.cpu) * 10) / 10;
    sys.mem[i] = Math.round((1000 * Number(r.mem_used)) / Number(r.mem_total)) / 10;
    sys.swap[i] = Number(r.swap_total) ? Math.round((1000 * Number(r.swap)) / Number(r.swap_total)) / 10 : 0;
    sys.rx[i] = Number(r.rx);
    sys.tx[i] = Number(r.tx);
  }
  const latest = one(`SELECT * FROM system_min ORDER BY ts DESC LIMIT 1`);
  const server = latest
    ? {
        at: Number(latest.ts),
        cpu: Number(latest.cpu_sum),
        cpus: Number(latest.cpus),
        load: Number(latest.load_sum),
        memTotal: Number(latest.mem_total),
        memUsed: Number(latest.mem_used_sum),
        swapTotal: Number(latest.swap_total),
        swapUsed: Number(latest.swap_used_max),
        diskTotal: Number(latest.disk_total),
        diskUsed: Number(latest.disk_used),
      }
    : null;

  // Disk growth over the last 14 days, to say when it fills up
  const diskThen = one(`SELECT disk_used FROM system_hour WHERE ts >= ? ORDER BY ts LIMIT 1`, now - 14 * 86400);
  const diskFirstTs = Number(one(`SELECT MIN(ts) AS t FROM system_hour WHERE ts >= ?`, now - 14 * 86400)?.t) || now;
  const spanDays = (now - diskFirstTs) / 86400;
  const growthPerDay = server && diskThen && spanDays >= 2 ? (server.diskUsed - Number(diskThen.disk_used)) / spanDays : null;
  const daysToAlert = server && growthPerDay && growthPerDay > 0 ? (server.diskTotal * (config.ALERT_DISK_PERCENT / 100) - server.diskUsed) / growthPerDay : null;

  /*--Apps (PM2)--*/
  const appNames = all(`SELECT DISTINCT app FROM apps WHERE ts >= ? ORDER BY app`, from).map((r) => r.app as string);
  const appMem: Record<string, (number | null)[]> = {};
  const appRestarts: Record<string, number> = {};
  for (const app of appNames) {
    appMem[app] = blank();
    for (const r of all(`SELECT ${groupBy} AS b, AVG(mem) AS mem FROM apps WHERE app = ? AND ts >= ? GROUP BY b`, app, from)) {
      const i = index.get(r.b as number);
      if (i !== undefined) appMem[app][i] = Number(r.mem);
    }
    const counters = all(`SELECT restarts FROM apps WHERE app = ? AND ts >= ? ORDER BY ts`, app, from).map((r) => Number(r.restarts));
    appRestarts[app] = counters.reduce((sum, c, i) => sum + (i && c > counters[i - 1] ? c - counters[i - 1] : 0), 0);
  }
  const latestAppsTs = Number(one(`SELECT MAX(ts) AS t FROM apps`)?.t) || 0;
  const apps = all(`SELECT app, status, cpu, mem, restarts, uptime FROM apps WHERE ts = ? ORDER BY app`, latestAppsTs).map((r) => ({
    name: r.app as string,
    status: r.status as string,
    cpu: Number(r.cpu),
    mem: Number(r.mem),
    uptime: Number(r.uptime),
    restartsInRange: appRestarts[r.app as string] ?? 0,
  }));

  /*--Checks now, and uptime over the range--*/
  const checks = all(`SELECT name, label, ok, detail, hint, since FROM check_state ORDER BY ok, name`).map((r) => ({
    name: r.name as string, label: r.label as string, ok: Boolean(r.ok), detail: r.detail as string, hint: r.hint as string | null, since: Number(r.since),
  }));
  const stripSegments = 60;
  const segment = Math.max(60, Math.ceil(range.seconds / stripSegments / 60) * 60);
  const uptime = ["site", "admin", "api"].map((name) => {
    const label = { site: "Public website", admin: "Staff panel", api: "API" }[name]!;
    const total = one(`SELECT COUNT(*) AS n, COALESCE(SUM(ok), 0) AS up, AVG(CASE WHEN ok = 1 THEN ms END) AS ms FROM check_result WHERE name = ? AND ts >= ?`, name, from)!;
    const segs = all(`SELECT CAST((ts - ?) / ? AS INTEGER) AS s, MIN(ok) AS ok FROM check_result WHERE name = ? AND ts >= ? GROUP BY s`, from, segment, name, from);
    const strip = Array.from({ length: Math.ceil(range.seconds / segment) }, () => null as number | null);
    for (const r of segs) if (Number(r.s) < strip.length) strip[Number(r.s)] = Number(r.ok);
    const n = Number(total.n);
    return { name, label, pct: n ? (100 * Number(total.up)) / n : null, checks: n, avgMs: total.ms === null ? null : Math.round(Number(total.ms)), strip, segment };
  });

  /*--Membership and data--*/
  const business = one(`SELECT * FROM business_day ORDER BY day DESC LIMIT 1`);
  const businessThen = one(`SELECT * FROM business_day WHERE day >= ? ORDER BY day LIMIT 1`, dayKey(now - 30 * 86400));
  const appsPerDay = applicationsPerDay(dayKey(now - 29 * 86400));
  const applications: { day: string; n: number }[] = [];
  for (let d = dayStart(now - 29 * 86400); d <= now; d += 86400) {
    const day = dayKey(d + 3600);
    applications.push({ day, n: Number(appsPerDay?.find((r) => r.day === day)?.n) || 0 });
  }

  const alerts = all(`SELECT ts, level, title, body, delivered FROM alerts ORDER BY ts DESC LIMIT 25`).map((r) => ({
    ts: Number(r.ts), level: r.level as string, title: r.title as string, body: r.body as string, delivered: Boolean(r.delivered),
  }));

  const pageP95 = percentileMs(latencyAll.page, 0.95);
  const apiP95 = percentileMs(latencyAll.api, 0.95);
  const siteUptime = uptime.find((u) => u.name === "site")!;

  const kpis = {
    visitors: rangeKey === "1h" || rangeKey === "24h" ? visitorsToday : visitorsTotal,
    visitorsLabel: rangeKey === "1h" || rangeKey === "24h" ? "Visitors today" : "Visitors",
    views: totals.views,
    viewsPrevious: previousViews,
    uptime: siteUptime.pct,
    pageP95,
    apiP95,
    errorRate: totals.requests ? (100 * totals.s5) / totals.requests : null,
    s5: totals.s5,
    botShare: totals.requests ? (100 * totals.bots) / (totals.requests + totals.bots) : null,
    bytes: totals.bytes,
  };

  /*--Advice: what the numbers say about scaling and hardening--*/
  const advice: Advice[] = [];
  const add = (level: Level, area: string, finding: string, action?: string) => advice.push({ level, area, finding, action });
  for (const c of checks.filter((c) => !c.ok)) add("act", c.label, c.detail, c.hint ?? undefined);

  const hourly = all(`SELECT cpu_sum / n AS cpu, mem_used_max * 100.0 / mem_total AS mem, swap_used_max AS swap FROM system_hour WHERE ts >= ?`, Math.max(from, now - 30 * 86400));
  const cpuP95 = quantile(hourly.map((r) => Number(r.cpu)), 0.95);
  const memP95 = quantile(hourly.map((r) => Number(r.mem)), 0.95);
  const swapMax = Math.max(0, ...hourly.map((r) => Number(r.swap)));
  const enoughData = hourly.length >= 12;
  if (enoughData && cpuP95 !== null) {
    if (cpuP95 > 70) add("act", "CPU", `The processor is ${Math.round(cpuP95)}% busy in busy hours`, "Move to a bigger server: Oracle's Always Free Ampere A1 allows up to 4 cores and 24 GB at no cost");
    else if (cpuP95 > 50) add("watch", "CPU", `The processor reaches ${Math.round(cpuP95)}% in busy hours`, "Not urgent. Plan more cores if it keeps rising.");
  }
  if (enoughData && memP95 !== null) {
    if (memP95 > 90 || swapMax > 256 * 1048576) add("act", "Memory", `Memory reaches ${Math.round(memP95)}% in busy hours${swapMax > 256 * 1048576 ? `, swap up to ${Math.round(swapMax / 1048576)} MB` : ""}`, "Add memory (Ampere A1, free up to 24 GB) before the apps start being restarted");
    else if (memP95 > 80) add("watch", "Memory", `Memory reaches ${Math.round(memP95)}% in busy hours`, "Keep an eye on app restarts below");
  }
  if (server) {
    const used = (100 * server.diskUsed) / server.diskTotal;
    if (used > config.ALERT_DISK_PERCENT - 5 || (daysToAlert !== null && daysToAlert < 60))
      add("act", "Disk", `Disk ${Math.round(used)}% used${daysToAlert !== null ? `; full in about ${Math.round(daysToAlert)} days at this rate` : ""}`, "Grow the boot volume (Oracle gives 200 GB free in total) or move uploaded documents to object storage");
    else if (daysToAlert !== null && daysToAlert < 180) add("watch", "Disk", `At this rate the disk reaches ${config.ALERT_DISK_PERCENT}% in about ${Math.round(daysToAlert)} days`, "Plan more disk space");
  }
  if (pageP95 !== null && pageP95 > 1500 && totals.views > 50) add("watch", "Website speed", `5% of page loads take ${(pageP95 / 1000).toFixed(1)} s or more on the server`, "Put Cloudflare (free) in front to cache pages, and check the slowest pages");
  for (const r of routes.filter((r) => r.requests >= 20 && (r.p95Ms ?? 0) >= 1000).slice(0, 3))
    add("watch", "API speed", `${r.route}: 5% of requests take ${((r.p95Ms ?? 0) / 1000).toFixed(1)} s or more`, "Find what makes this route slow (database query, PDF or file work); more hardware rarely fixes one slow route");
  if (kpis.errorRate !== null && kpis.errorRate > 1 && totals.requests > 100) add("act", "Errors", `${kpis.errorRate.toFixed(1)}% of requests failed with a server error`, "pm2 logs bsrea-api and pm2 logs bsrea-site");
  if (siteUptime.pct !== null && siteUptime.checks >= 12) {
    if (siteUptime.pct < 99.5) add("act", "Uptime", `The website was up ${siteUptime.pct.toFixed(2)}% of the time`, "Read the alert history below and fix the cause");
    else if (siteUptime.pct < 99.9) add("watch", "Uptime", `The website was up ${siteUptime.pct.toFixed(2)}% of the time`);
  }
  for (const a of apps) if (a.restartsInRange > 5) add("act", "Stability", `${a.name} restarted ${a.restartsInRange} times`, `pm2 logs ${a.name} --lines 200: a crash, or its memory limit is too low`);
  const thisWeek = Number(one(`SELECT COALESCE(SUM(views), 0) AS v FROM traffic_hour WHERE ts >= ?`, now - 7 * 86400)?.v);
  const lastWeek = Number(one(`SELECT COALESCE(SUM(views), 0) AS v FROM traffic_hour WHERE ts >= ? AND ts < ?`, now - 14 * 86400, now - 7 * 86400)?.v);
  if (lastWeek > 0 && thisWeek > 1000 && thisWeek / lastWeek > 1.5) add("watch", "Traffic growth", `Page views up ${Math.round((100 * thisWeek) / lastWeek - 100)}% on last week`, "Good news. Watch CPU and memory; if it keeps growing, plan the next server size.");
  if (kpis.botShare !== null && kpis.botShare > 60 && totals.requests > 1000) add("watch", "Bots", `${Math.round(kpis.botShare)}% of requests come from bots and scanners`, "Cloudflare's free bot protection filters most of them out");
  const live = readBusiness();
  const oldestDays = live?.oldestPending ? Math.floor((now * 1000 - Date.parse(live.oldestPending)) / 86_400_000) : 0;
  if (oldestDays > 14) add("watch", "Applications", `A membership application has waited ${oldestDays} days for a decision`, "Remind the approvers in the staff panel");
  if (collectorStatus.lastLogProblem) add("watch", "Website traffic", `Visits are not being counted: ${collectorStatus.lastLogProblem}`, "Run monitoring/deploy/install.sh on the server (sets up the nginx log)");
  if (!config.ALERT_WEBHOOK_URL) add("watch", "Alerts", "Alerts are only shown here: nobody is notified when something breaks", "Set ALERT_WEBHOOK_URL in monitoring/.env (free ntfy app, see the README)");
  if (!advice.length) add("ok", "All good", "Nothing needs attention: every check passes and no limit is close");
  const order: Record<Level, number> = { act: 0, watch: 1, ok: 2 };
  advice.sort((a, b) => order[a.level] - order[b.level]);

  /*--Security: the verdict now, blocked addresses, attack history--*/
  const verdict = (name: string) => checks.find((c) => c.name === name) ?? null;
  const security = {
    protection: verdict("security"),
    visitors: verdict("visitors"),
    autoBlock: config.AUTO_BLOCK,
    totals: { limited: totals.limited, probes: totals.probes, loginFails: totals.loginFails, bots: totals.bots, requests: totals.requests },
    // Full addresses only while blocked, so staff can unblock one; the history below keeps them masked
    blocked: all(`SELECT ip, reason, since, until, strikes FROM bans WHERE until > ? ORDER BY since DESC LIMIT 200`, now).map((r) => ({
      ip: r.ip as string, reason: r.reason as string, since: Number(r.since), until: Number(r.until), strikes: Number(r.strikes),
    })),
    blockLog: all(`SELECT ts, ip_masked, reason, until, action FROM ban_log WHERE ts >= ? ORDER BY ts DESC LIMIT 50`, from).map((r) => ({
      ts: Number(r.ts), ip: r.ip_masked as string, reason: r.reason as string, until: Number(r.until), action: r.action as string,
    })),
    episodes: all(`SELECT * FROM security_events WHERE COALESCE(end, ?) >= ? ORDER BY start DESC LIMIT 30`, now, from).map((r) => ({
      start: Number(r.start), end: r.end === null ? null : Number(r.end), kinds: r.kinds as string, detail: r.detail as string,
      peakPerMin: Number(r.peak_per_min), blocked: Number(r.blocked), affected: Boolean(r.affected), impact: r.impact as string | null,
    })),
  };

  return {
    generatedAt: now,
    range: { key: rangeKey, label: range.label, step, from, to: now },
    collector: { lastRun: collectorStatus.lastRun, logProblem: collectorStatus.lastLogProblem ?? null, alertsConfigured: Boolean(config.ALERT_WEBHOOK_URL) },
    checks,
    kpis,
    advice,
    series: { t, views, requests, errors, latency, system: sys, appMem, security: sec },
    security,
    daily,
    topPages,
    routes,
    server: server && { ...server, growthPerDay, daysToAlert, alertPercent: config.ALERT_DISK_PERCENT },
    apps,
    uptime,
    business: business
      ? {
          day: business.day as string,
          members: business.members as number | null,
          pending: business.pending as number | null,
          dbBytes: Number(business.db_bytes),
          docsBytes: Number(business.docs_bytes),
          backupBytes: Number(business.backup_bytes),
          membersMonthAgo: (businessThen?.members as number | null) ?? null,
          oldestPendingDays: live?.pending ? oldestDays : null,
          applicationsToday: (business.applications as number | null) ?? null,
          applications: appsPerDay ? applications : null,
        }
      : null,
    alerts,
  };
};

export type Dashboard = ReturnType<typeof buildDashboard>;

/*--Each page gets only its own numbers (plus the shared header: time range, collector, problem count)--*/
export const PAGES = ["overview", "traffic", "performance", "server", "security", "uptime", "membership"] as const;
export type PageKey = (typeof PAGES)[number];

export const buildPage = (page: PageKey, rangeKey: RangeKey, now = nowSec()) => {
  const d = buildDashboard(rangeKey, now);
  const { t } = d.series;
  const shared = { page, generatedAt: d.generatedAt, range: d.range, collector: d.collector, problems: d.checks.filter((c) => !c.ok).map((c) => c.label) };
  switch (page) {
    case "overview":
      return { ...shared, checks: d.checks, kpis: d.kpis, advice: d.advice, uptime: d.uptime, server: d.server, series: { t, views: d.series.views, latency: d.series.latency } };
    case "traffic":
      return { ...shared, kpis: d.kpis, daily: d.daily, topPages: d.topPages, series: { t, views: d.series.views, requests: d.series.requests } };
    case "performance":
      return { ...shared, kpis: d.kpis, routes: d.routes, series: { t, latency: d.series.latency, errors: d.series.errors } };
    case "server":
      return { ...shared, server: d.server, apps: d.apps, series: { t, system: d.series.system, appMem: d.series.appMem } };
    case "security":
      return { ...shared, security: d.security, series: { t, security: d.series.security } };
    case "uptime":
      return { ...shared, uptime: d.uptime, alerts: d.alerts, checks: d.checks };
    case "membership":
      return { ...shared, business: d.business };
  }
};
