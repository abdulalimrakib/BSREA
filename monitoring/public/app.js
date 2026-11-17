// BSREA monitoring dashboard. One app, seven pages (/, /traffic, /performance, /server, /security, /uptime, /membership):
// it shows the sections of the page in the address and fetches only that page's numbers (/api/page/<page>).
// Refreshes every minute while the tab is open; charts keep their last drawing while new numbers load.

import { columnChart, emptyState, fmt, formatDay, h, lineChart, seriesTable, sparkline, svg, timeLong, timeTick } from "./charts.js";

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
const RANGES = ["1h", "24h", "7d", "30d", "90d", "1y"];
const PAGE_NAMES = { overview: "Overview", traffic: "Traffic", performance: "Performance", server: "Server", security: "Security", uptime: "Uptime & alerts", membership: "Membership" };
const PAGE = location.pathname === "/" ? "overview" : location.pathname.slice(1) in PAGE_NAMES ? location.pathname.slice(1) : "overview";
let range = new URLSearchParams(location.search).get("range") ?? store.get("range") ?? "24h";
if (!RANGES.includes(range)) range = "24h";
let data = null;
const tableMode = new Set();

/* ---------- Icons: status is never colour alone ---------- */
const ICONS = {
  good: { color: "var(--good)", word: "OK", path: "M8 12.5l2.6 2.6L16 9.5" },
  warning: { color: "var(--warning)", word: "Keep an eye", path: "M12 8v5M12 16.5v.01" },
  critical: { color: "var(--critical)", word: "Problem", path: "M12 7.5v6M12 16.5v.01" },
  none: { color: "var(--none)", word: "No data", path: "M8 12h8" },
};
const statusIcon = (kind, cls = "status-icon") => {
  const icon = ICONS[kind];
  const root = svg("svg", { viewBox: "0 0 24 24", class: cls, "aria-hidden": "true" });
  if (kind === "warning") svg("path", { d: "M12 2.8L22.5 21H1.5z", style: `fill:${icon.color}`, "stroke-linejoin": "round" }, root);
  else svg("circle", { cx: 12, cy: 12, r: 10.5, style: `fill:${icon.color}` }, root);
  svg("path", { d: icon.path, fill: "none", stroke: kind === "warning" ? "#0b0b0b" : "#fff", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", transform: kind === "warning" ? "translate(0 1.5)" : undefined }, root);
  return root;
};
const pill = (kind, text) => h("span", { class: "pill" }, statusIcon(kind), text ?? ICONS[kind].word);

const toast = (text) => {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
};

const ago = (sec) => fmt.duration(Math.max(60, Date.now() / 1000 - sec));
const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];

/* ---------- Overview ---------- */
const renderOverview = (d) => {
  const failing = d.checks.filter((c) => !c.ok);
  const banner = !d.checks.length
    ? h("div", { class: "banner" }, statusIcon("none", "big-icon"), h("div", {}, h("h2", { text: "Waiting for the first checks" }), h("p", { text: "The first results appear within a few minutes of starting." })))
    : failing.length
      ? h("div", { class: "banner bad" }, statusIcon("critical", "big-icon"), h("div", {}, h("h2", { text: `${failing.length} problem${failing.length > 1 ? "s" : ""} need${failing.length > 1 ? "" : "s"} attention` }), h("p", { text: failing.map((c) => c.label).join(", ") })))
      : h("div", { class: "banner good" }, statusIcon("good", "big-icon"), h("div", {}, h("h2", { text: "Everything is working" }), h("p", { text: `All ${d.checks.length} checks passed. Checked every 5 minutes.` })));
  $("banner").replaceChildren(banner);

  const checkCard = (c) =>
      h("div", { class: `check${c.ok ? "" : " bad"}` },
        statusIcon(c.ok ? "good" : "critical"),
        h("div", { style: "min-width:0" },
          h("strong", { text: c.label }),
          h("div", { class: "detail" }, h("span", { class: "visually-hidden", text: c.ok ? "OK: " : "Problem: " }), c.detail),
          !c.ok ? h("div", { class: "hint" }, `For ${ago(c.since)}. `, c.hint ? h("span", {}, "What to do: ", h("code", { text: c.hint })) : null) : null,
        ),
      );
  // Problems always show; passing checks fold away on a phone so the problems stay on the first screen
  const passing = d.checks.filter((c) => c.ok);
  const wasOpen = $("checks").querySelector("details")?.open;
  const fold = passing.length
    ? h("details", { class: "ok-checks", open: wasOpen ?? innerWidth > 640 },
        h("summary", {}, statusIcon("good"), `${passing.length} check${passing.length > 1 ? "s" : ""} passing`),
        h("div", { class: "checks" }, passing.map(checkCard)))
    : null;
  $("checks").replaceChildren(failing.length ? h("div", { class: "checks" }, failing.map(checkCard)) : "", fold ?? "");

  const k = d.kpis;
  const viewsSeries = d.series.views.site.map((v, i) => (v == null && d.series.views.admin[i] == null ? null : (v ?? 0) + (d.series.views.admin[i] ?? 0)));
  const change = k.viewsPrevious > 0 ? ((k.views - k.viewsPrevious) / k.viewsPrevious) * 100 : null;
  const disk = d.server ? (100 * d.server.diskUsed) / d.server.diskTotal : null;
  const tile = (label, value, sub, spark) => h("div", { class: "card kpi" }, h("div", { class: "label", text: label }), h("div", { class: "value", text: value }), h("div", { class: "sub" }, sub ?? ""), spark ?? null);
  $("kpis").replaceChildren(
    tile(k.visitorsLabel, fmt.compact(k.visitors), "people, each counted once a day"),
    tile("Page views", fmt.compact(k.views),
      change == null ? "no earlier period to compare" : h("span", {}, h("span", { class: change >= 0 ? "delta-up" : "delta-down", text: `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}%` }), " vs the period before"),
      sparkline(viewsSeries)),
    tile("Website uptime", k.uptime == null ? "–" : `${k.uptime >= 99.995 ? "100" : k.uptime.toFixed(2)}%`, d.uptime[0]?.checks ? `${fmt.int(d.uptime[0].checks)} checks` : "no checks yet"),
    tile("Page speed", fmt.ms(k.pageP95), "95% of pages are faster", sparkline(d.series.latency.page)),
    tile("Failed requests", k.errorRate == null ? "–" : fmt.pct(k.errorRate, k.errorRate < 1 ? 2 : 1), `${fmt.int(k.s5)} server errors`),
    tile("Disk used", disk == null ? "–" : fmt.pct(disk), d.server ? `${fmt.bytes(d.server.diskTotal - d.server.diskUsed)} free` : ""),
  );

  const notices = [];
  if (d.collector.logProblem) notices.push(h("div", { class: "notice" }, h("strong", { text: "Website visits are not being counted. " }), d.collector.logProblem));
  $("notices").replaceChildren(...notices);

  const LEVEL = { act: ["critical", "Act now"], watch: ["warning", "Keep an eye"], ok: ["good", "All good"] };
  $("advice").replaceChildren(
    ...d.advice.map((a) =>
      h("div", { class: `advice-item ${a.level}` },
        h("span", { class: "level" }, statusIcon(LEVEL[a.level][0]), LEVEL[a.level][1]),
        h("div", { class: "what" }, h("strong", { text: `${a.area}: ` }), a.finding),
        a.action ? h("div", { class: "todo" }, "→ ", a.action) : null,
      ),
    ),
  );
};

/* ---------- Charts: each [data-chart] card has a title, a chart and a table view ---------- */
const timeSeries = (d, series, format, extra = {}) => ({ t: d.series.t, step: d.range.step, series, format, ...extra });
const someData = (values) => values.some((v) => v != null && v !== 0);

const CHARTS = {
  views: (d) => {
    const series = [{ name: "Website", values: d.series.views.site, color: COLORS[0] }];
    if (someData(d.series.views.admin)) series.push({ name: "Staff panel", values: d.series.views.admin, color: COLORS[1] });
    return { title: "Page views", sub: `Per ${stepName(d.range.step)}`, kind: "line", opts: timeSeries(d, series, fmt.compact, { area: true, height: 330, empty: "No visits recorded yet. They appear once nginx writes the BSREA log." }) };
  },
  daily: (d) => ({
    title: "Visitors per day",
    sub: `Last ${d.daily.length} days`,
    kind: "column",
    opts: { labels: d.daily.map((r) => fmtDayShort(r.day)), titles: d.daily.map((r) => formatDay(r.day)), series: [{ name: "Visitors", values: d.daily.map((r) => r.visitors), color: COLORS[0] }, ], format: fmt.compact },
  }),
  latency: (d) => ({
    title: "Response time",
    sub: "95% of requests answer faster than this",
    kind: "line",
    opts: timeSeries(d, [{ name: "Website pages", values: d.series.latency.page, color: COLORS[0] }, { name: "API", values: d.series.latency.api, color: COLORS[1] }], fmt.ms),
  }),
  errors: (d) => ({
    title: "Failed requests",
    sub: "Server errors mean something broke; refused or not found are mostly bots and old links",
    kind: "column",
    opts: {
      labels: d.series.t.map((s) => timeTick(s, d.range.to - d.range.from)),
      titles: d.series.t.map((s) => timeLong(s, d.range.step)),
      series: [{ name: "Refused / not found (4xx)", values: d.series.errors.s4, color: COLORS[0] }, { name: "Server errors (5xx)", values: d.series.errors.s5, color: COLORS[1] }],
      format: fmt.compact,
      empty: "No failed requests in this period",
    },
  }),
  system: (d) => ({
    title: "CPU and memory",
    sub: "Average per step, % of the server",
    kind: "line",
    opts: timeSeries(d, [{ name: "CPU", values: d.series.system.cpu, color: COLORS[0] }, { name: "Memory", values: d.series.system.mem, color: COLORS[1] }, { name: "Swap", values: d.series.system.swap, color: COLORS[2] }], (v) => fmt.pct(v), { max: 100 }),
  }),
  network: (d) => ({
    title: "Network",
    sub: `Data per ${stepName(d.range.step)}`,
    kind: "line",
    opts: timeSeries(d, [{ name: "Sent to visitors", values: d.series.system.tx, color: COLORS[0] }, { name: "Received", values: d.series.system.rx, color: COLORS[1] }], fmt.bytes, { binary: true }),
  }),
  appmem: (d) => ({
    title: "App memory",
    sub: "PM2 restarts an app that passes its limit",
    kind: "line",
    opts: timeSeries(d, Object.entries(d.series.appMem).slice(0, 4).map(([name, values], i) => ({ name, values, color: COLORS[i] })), fmt.bytes, { binary: true, empty: "PM2 is not running on this machine" }),
  }),
  "visitors-vs-bots": (d) => ({
    title: "Who is knocking",
    sub: `Requests per ${stepName(d.range.step)}: people, robots, and requests refused for coming too fast`,
    kind: "line",
    opts: timeSeries(d, [
      { name: "Real visitors", values: d.series.security.real, color: COLORS[0] },
      { name: "Bots and scanners", values: d.series.security.bots, color: COLORS[1] },
      { name: "Refused (too fast)", values: d.series.security.limited, color: COLORS[2] },
    ], fmt.compact, { empty: "No requests recorded yet" }),
  }),
  attempts: (d) => ({
    title: "Attack attempts",
    sub: "Looking for weak spots (.php, .env, wp-login…) and wrong staff passwords",
    kind: "column",
    opts: {
      labels: d.series.t.map((s) => timeTick(s, d.range.to - d.range.from)),
      titles: d.series.t.map((s) => timeLong(s, d.range.step)),
      series: [{ name: "Probes for weak spots", values: d.series.security.probes, color: COLORS[0] }, { name: "Failed staff sign-ins", values: d.series.security.loginFails, color: COLORS[1] }],
      format: fmt.compact,
      empty: "No attack attempts in this period",
    },
  }),
  applications: (d) => {
    const apps = d.business?.applications;
    return {
      title: "Membership applications per day",
      sub: "Last 30 days",
      kind: "column",
      opts: apps ? { labels: apps.map((r) => fmtDayShort(r.day)), titles: apps.map((r) => formatDay(r.day)), series: [{ name: "Applications", values: apps.map((r) => r.n), color: COLORS[0] }], format: fmt.int, empty: "No applications in the last 30 days" } : null,
      empty: "Not connected to the membership database (BACKEND_DB in monitoring/.env)",
    };
  },
};

const stepName = (step) => ({ 60: "minute", 900: "15 minutes", 3600: "hour", 21600: "6 hours", 86400: "day" })[step] ?? "step";
const fmtDayShort = (day) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00`));

const renderChart = (card, d) => {
  const name = card.dataset.chart;
  const def = CHARTS[name](d);
  const showTable = tableMode.has(name);
  const toggle = h("button", { class: "table-toggle", type: "button", "aria-pressed": String(showTable), text: showTable ? "Chart" : "Table" });
  toggle.addEventListener("click", () => {
    if (tableMode.has(name)) tableMode.delete(name); else tableMode.add(name);
    renderChart(card, data);
  });
  const body = h("div", { class: "chart" });
  card.replaceChildren(h("div", { class: "card-head" }, h("div", {}, h("h3", { text: def.title }), h("p", { text: def.sub })), def.opts ? toggle : null), body);
  if (!def.opts) return emptyState(body, def.empty);
  if (showTable) return body.replaceChildren(seriesTable({ ...def.opts, labels: def.kind === "column" ? def.opts.titles : undefined }));
  (def.kind === "line" ? lineChart : columnChart)(body, { ...def.opts, label: def.title });
};
// Only the charts on the page being shown
const renderCharts = (d) => document.querySelectorAll("section:not([hidden]) [data-chart]").forEach((card) => renderChart(card, d));

/* ---------- Visitors: top pages and facts ---------- */
const renderTraffic = (d) => {
  const max = Math.max(1, ...d.topPages.map((p) => p.views));
  $("pages").replaceChildren(
    d.topPages.length
      ? h("div", { class: "bars" }, d.topPages.slice(0, 10).map((p) =>
          h("div", { class: "bar-row" },
            h("span", { class: "name", title: p.path, text: `${p.site === "Staff panel" ? "Staff panel " : ""}${p.path}` }),
            h("span", { class: "val", text: fmt.int(p.views) }),
            h("div", { class: "bar-track", "aria-hidden": "true" }, h("div", { class: "bar-fill", style: `width:${((100 * p.views) / max).toFixed(1)}%` })),
          )))
      : h("div", { class: "empty", text: "No page views yet" }),
  );
  const k = d.kpis;
  const totalReq = d.series.requests.reduce((a, b) => a + (b ?? 0), 0);
  const rows = [
    ["Page views", fmt.int(k.views)],
    ["Requests to pages and API", fmt.int(totalReq)],
    ["Requests from bots and scanners", k.botShare == null ? "–" : fmt.pct(k.botShare)],
    ["Data sent", fmt.bytes(k.bytes)],
    ["Typical API answer (95%)", fmt.ms(k.apiP95)],
  ];
  $("traffic-facts").replaceChildren(h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, rows.map(([a, b]) => h("tr", {}, h("td", { text: a }), h("td", { class: "n", text: b })))))));
};

const renderRoutes = (d) => {
  if (!d.routes.length) return $("routes").replaceChildren(h("div", { class: "empty", text: "No API requests in this period" }));
  $("routes").replaceChildren(
    h("div", { class: "table-wrap" },
      h("table", {},
        h("thead", {}, h("tr", {}, h("th", { text: "Route" }), h("th", { class: "n", text: "Requests" }), h("th", { class: "n", text: "Average" }), h("th", { class: "n", text: "95% within" }), h("th", { class: "n", text: "Server errors" }))),
        h("tbody", {}, d.routes.slice(0, 15).map((r) =>
          h("tr", { class: (r.p95Ms ?? 0) >= 1000 ? "slow" : "" },
            h("td", { class: "route", text: r.route }), h("td", { class: "n", text: fmt.int(r.requests) }), h("td", { class: "n", text: fmt.ms(r.avgMs) }),
            h("td", { class: "n" }, (r.p95Ms ?? 0) >= 1000 ? h("span", { class: "visually-hidden", text: "Slow: " }) : null, fmt.ms(r.p95Ms)),
            h("td", { class: "n", text: r.errors ? fmt.int(r.errors) : "–" }),
          ))),
      )),
  );
};

/* ---------- Server ---------- */
const meter = (label, pct, value, sub, warnAt, badAt) =>
  h("div", { class: "card meter" },
    h("div", { class: "small", style: "color:var(--ink-2)", text: label }),
    h("div", { class: "value", text: value }),
    h("div", { class: "track", role: "meter", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(pct ?? 0)) },
      h("div", { class: `fill${pct >= badAt ? " bad" : pct >= warnAt ? " warn" : ""}`, style: `width:${Math.min(100, pct ?? 0).toFixed(1)}%` })),
    h("div", { class: "sub" }, sub),
  );

const renderServer = (d) => {
  const s = d.server;
  if (!s) return $("meters").replaceChildren(h("div", { class: "empty", style: "grid-column:1/-1", text: "No server samples yet: the first arrives a minute after starting" }));
  $("server-sub").textContent = `${s.cpus} CPU core${s.cpus > 1 ? "s" : ""}, ${fmt.bytes(s.memTotal)} memory, ${fmt.bytes(s.diskTotal)} disk. Last sample ${ago(s.at)} ago.`;
  const disk = (100 * s.diskUsed) / s.diskTotal;
  const forecast = s.daysToAlert == null ? "Not growing" : s.daysToAlert > 730 ? `Growing ${fmt.bytes(s.growthPerDay)} a day: years left` : `Reaches ${s.alertPercent}% in about ${Math.round(s.daysToAlert)} days`;
  $("meters").replaceChildren(
    meter("CPU now", s.cpu, fmt.pct(s.cpu), `Load ${s.load.toFixed(2)} on ${s.cpus} core${s.cpus > 1 ? "s" : ""}`, 60, 85),
    meter("Memory now", (100 * s.memUsed) / s.memTotal, fmt.pct((100 * s.memUsed) / s.memTotal), `${fmt.bytes(s.memTotal - s.memUsed)} free of ${fmt.bytes(s.memTotal)}`, 80, 90),
    meter("Swap (overflow memory)", s.swapTotal ? (100 * s.swapUsed) / s.swapTotal : 0, s.swapTotal ? fmt.bytes(s.swapUsed) : "None", s.swapTotal ? `of ${fmt.bytes(s.swapTotal)}; heavy use slows everything` : "No swap file", 25, 50),
    meter("Disk", disk, fmt.pct(disk), `${fmt.bytes(s.diskTotal - s.diskUsed)} free. ${forecast}`, s.alertPercent - 10, s.alertPercent),
  );
};

/* ---------- Apps ---------- */
const renderApps = (d) => {
  if (!d.apps.length) return $("apps-table").replaceChildren(h("div", { class: "empty", text: "PM2 is not running on this machine" }));
  $("apps-table").replaceChildren(
    h("div", { class: "table-wrap" },
      h("table", {},
        h("thead", {}, h("tr", {}, h("th", { text: "App" }), h("th", { text: "Status" }), h("th", { class: "n", text: "Memory" }), h("th", { class: "n", text: "CPU" }), h("th", { class: "n", text: "Running for" }), h("th", { class: "n", text: "Restarts" }))),
        h("tbody", {}, d.apps.map((a) =>
          h("tr", {},
            h("td", { text: a.name }),
            h("td", {}, a.status === "online" ? pill("good", "Running") : pill("critical", a.status)),
            h("td", { class: "n", text: fmt.bytes(a.mem) }), h("td", { class: "n", text: fmt.pct(a.cpu, 1) }),
            h("td", { class: "n", text: a.uptime ? fmt.duration(a.uptime) : "–" }),
            h("td", { class: "n" }, a.restartsInRange > 5 ? pill("warning", String(a.restartsInRange)) : String(a.restartsInRange)),
          ))),
      )),
  );
};

/* ---------- Uptime ---------- */
const renderUptime = (d) => {
  const rows = d.uptime.filter((u) => u.checks);
  if (!rows.length) return $("uptime-rows").replaceChildren(h("div", { class: "empty", text: "No checks recorded yet" }));
  $("uptime-rows").replaceChildren(
    ...rows.map((u) => {
      const strip = h("div", { class: "strip", role: "img", "aria-label": `${u.label}: ${u.pct.toFixed(2)}% up` },
        u.strip.map((ok, i) => h("i", { class: ok === 1 ? "up" : ok === 0 ? "down" : "", title: `${timeLong(d.range.from + i * u.segment, u.segment)}: ${ok === 1 ? "up" : ok === 0 ? "down at least once" : "not checked"}` })));
      return h("div", { class: "uptime-row" },
        h("div", {}, h("strong", { text: u.label }), h("div", { class: "small muted", text: u.avgMs == null ? "" : `answers in ${fmt.ms(u.avgMs)} on average` })),
        h("div", { class: "strip-wrap" }, strip, h("div", { class: "strip-axis" }, h("span", { text: timeTick(d.range.from, d.range.to - d.range.from) }), h("span", { text: "now" }))),
        h("div", { class: "pct" }, `${u.pct >= 99.995 ? "100" : u.pct.toFixed(2)}%`, h("small", { text: `${fmt.int(u.checks)} checks` })),
      );
    }),
  );
};

/* ---------- Membership ---------- */
const renderBusiness = (d) => {
  const b = d.business;
  if (!b) return $("biz-kpis").replaceChildren(h("div", { class: "empty", style: "grid-column:1/-1", text: "No membership numbers yet (read once an hour)" }));
  const tile = (label, value, sub) => h("div", { class: "card kpi" }, h("div", { class: "label", text: label }), h("div", { class: "value", text: value }), h("div", { class: "sub", text: sub ?? "" }));
  const growth = b.members != null && b.membersMonthAgo != null ? b.members - b.membersMonthAgo : null;
  $("biz-kpis").replaceChildren(
    tile("Members", fmt.int(b.members), growth == null ? "" : `${growth >= 0 ? "+" : ""}${growth} in 30 days`),
    tile("Waiting for a decision", fmt.int(b.pending), b.oldestPendingDays ? `oldest waiting ${b.oldestPendingDays} days` : "applications"),
    tile("Database", fmt.bytes(b.dbBytes), "member records"),
    tile("Uploaded documents", fmt.bytes(b.docsBytes), "encrypted"),
    tile("Backups", fmt.bytes(b.backupBytes), "on this server"),
    tile("Applications today", fmt.int(b.applicationsToday), "counted hourly"),
  );
};

/* ---------- Alerts ---------- */
const renderAlerts = (d) => {
  $("alerts-sub").textContent = d.collector.alertsConfigured
    ? "Sent to your phone when something breaks, every few hours while it stays broken, and when it is fixed"
    : "Only shown here for now: set ALERT_WEBHOOK_URL in monitoring/.env to get them on your phone";
  $("test-alert").hidden = !d.collector.alertsConfigured;
  if (!d.alerts.length) return $("alert-list").replaceChildren(h("div", { class: "empty", text: "No alerts yet. Good." }));
  $("alert-list").replaceChildren(
    ...d.alerts.map((a) =>
      h("div", { class: "alert" },
        statusIcon(a.level === "fixed" ? "good" : "critical"),
        h("strong", { text: a.title }),
        h("time", { datetime: new Date(a.ts * 1000).toISOString(), text: `${timeLong(a.ts, 60)}${a.delivered ? "" : " · not delivered"}` }),
        h("div", { class: "body", text: a.body }),
      )),
  );
};

/* ---------- Security ---------- */
const shieldIcon = (cls = "status-icon") => {
  const root = svg("svg", { viewBox: "0 0 24 24", class: cls, "aria-hidden": "true" });
  svg("path", { d: "M12 1.8l9 3.4v6.3c0 5.6-3.8 9.6-9 10.9-5.2-1.3-9-5.3-9-10.9V5.2z", style: "fill:var(--good)" }, root);
  svg("path", { d: "M8 12.3l2.7 2.7L16.2 9.4", fill: "none", stroke: "#fff", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, root);
  return root;
};

const renderSecurity = (d) => {
  const s = d.security;
  const p = s.protection;
  const affected = p && !p.ok;
  const blocked = p && p.ok && p.detail.startsWith("Attack blocked");
  const banner = !p
    ? h("div", { class: "banner" }, statusIcon("none", "big-icon"), h("div", {}, h("h2", { text: "Waiting for the first check" }), h("p", { text: "Attacks are checked every minute." })))
    : affected
      ? h("div", { class: "banner bad" }, statusIcon("critical", "big-icon"), h("div", {}, h("h2", { text: "Under attack: visitors are affected" }), h("p", { text: p.detail }), p.hint ? h("p", {}, "What to do: ", p.hint) : null))
      : blocked
        // A stopped attack is not a warning: calm, with the protection's shield
        ? h("div", { class: "banner calm" }, shieldIcon("big-icon"), h("div", {}, h("h2", { text: "Attack blocked: visitors are not affected" }), h("p", { text: p.detail.replace(/^Attack blocked: /, "") })))
        : h("div", { class: "banner good" }, shieldIcon("big-icon"), h("div", {}, h("h2", { text: "No attack right now" }), h("p", { text: `${s.autoBlock ? "Protection is on: attackers are blocked automatically." : "Watching only: automatic blocking is off (AUTO_BLOCK=0)."} ${p.detail.replace("No attack right now.", "").trim()}` })));
  const v = s.visitors;
  $("verdict").replaceChildren(
    banner,
    v ? h("div", { class: `check mt-10${v.ok ? "" : " bad"}` }, statusIcon(v.ok ? "good" : "critical"), h("div", {}, h("strong", { text: "Real visitors" }), h("div", { class: "detail", text: v.detail }), !v.ok && v.hint ? h("div", { class: "hint", text: `What to do: ${v.hint}` }) : null)) : "",
  );

  const t = s.totals;
  const tile = (label, value, sub) => h("div", { class: "card kpi" }, h("div", { class: "label", text: label }), h("div", { class: "value", text: value }), h("div", { class: "sub", text: sub ?? "" }));
  $("security-kpis").replaceChildren(
    tile("Blocked right now", fmt.int(s.blocked.length), s.blocked.length === 1 ? "address" : "addresses"),
    tile("Attacks", fmt.int(s.episodes.length), (() => { const hurt = s.episodes.filter((e) => e.affected).length; return hurt ? `visitors noticed ${hurt}` : "visitors noticed none"; })()),
    tile("Refused (too fast)", fmt.compact(t.limited), "requests"),
    tile("Probes for weak spots", fmt.compact(t.probes), ".php, .env, wp-login…"),
    tile("Failed staff sign-ins", fmt.compact(t.loginFails), "wrong password or code"),
    tile("From bots", t.requests ? fmt.pct((100 * t.bots) / t.requests) : "–", "of page and API requests"),
  );

  const until = (sec) => fmt.duration(Math.max(60, sec - Date.now() / 1000));
  $("blocked").replaceChildren(
    s.blocked.length
      ? h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", { text: "Address" }), h("th", { text: "Why" }), h("th", { text: "Blocked" }), h("th", { text: "Ends in" }), h("th", {}))),
          h("tbody", {}, s.blocked.map((b) => {
            const button = h("button", { class: "unblock", type: "button", text: "Unblock" });
            button.addEventListener("click", async () => {
              if (!confirm(`Unblock ${b.ip}?\n\nOnly do this if a real person was blocked by mistake.`)) return;
              const res = await fetch("/api/unblock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip: b.ip }) });
              const body = await res.json().catch(() => ({}));
              toast(body.message ?? body.error ?? "Could not unblock");
              load();
            });
            return h("tr", {}, h("td", { class: "ip", text: b.ip }), h("td", { text: `${b.reason}${b.strikes > 1 ? ` (time ${b.strikes})` : ""}` }), h("td", { class: "n", text: timeLong(b.since, 60) }), h("td", { class: "n", text: until(b.until) }), h("td", {}, button));
          }))))
      : h("div", { class: "empty", text: s.autoBlock ? "No address is blocked right now" : "Automatic blocking is off (AUTO_BLOCK=0 in monitoring/.env)" }),
    s.blockLog.length
      ? h("details", { class: "guide" }, h("summary", { text: `Blocks in this period (${s.blockLog.length})` }),
          h("div", { class: "table-wrap" }, h("table", {},
            h("thead", {}, h("tr", {}, h("th", { text: "When" }), h("th", { text: "Address" }), h("th", { text: "What happened" }))),
            h("tbody", {}, s.blockLog.map((l) => h("tr", {}, h("td", { class: "n", text: timeLong(l.ts, 60) }), h("td", { class: "ip", text: l.ip }), h("td", { text: l.action === "unblocked" ? "Unblocked from the dashboard" : l.reason })))))))
      : "",
  );

  $("episodes").replaceChildren(
    s.episodes.length
      ? h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", { text: "When" }), h("th", { text: "What" }), h("th", { class: "n", text: "Peak a minute" }), h("th", { class: "n", text: "Refused" }), h("th", { text: "Visitors" }))),
          h("tbody", {}, s.episodes.map((e) => h("tr", {},
            h("td", { text: `${timeLong(e.start, 60)}${e.end ? ` – ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e.end * 1000))}` : " – still going"}` }),
            h("td", { text: e.kinds }),
            h("td", { class: "n", text: fmt.int(e.peakPerMin) }),
            h("td", { class: "n", text: fmt.int(e.blocked) }),
            h("td", {}, e.affected ? h("div", {}, pill("critical", "Affected"), h("div", { class: "small muted", text: e.impact ?? "" })) : pill("good", "Not affected")),
          )))))
      : h("div", { class: "empty", text: "No attacks in this period" }),
  );
};

/* ---------- Loading and refreshing ---------- */
const RENDER = {
  overview: (d) => renderOverview(d),
  traffic: (d) => { renderTraffic(d); $("pages-sub").textContent = d.range.label; },
  performance: (d) => renderRoutes(d),
  server: (d) => { renderServer(d); renderApps(d); },
  security: (d) => renderSecurity(d),
  uptime: (d) => { renderUptime(d); renderAlerts(d); },
  membership: (d) => renderBusiness(d),
};

const render = (d) => {
  RENDER[PAGE](d);
  renderCharts(d);
  // Problems show on every page, in the header and on the Overview tab
  const pill = $("status-pill");
  pill.hidden = false;
  pill.className = `status-pill${d.problems.length ? " bad" : ""}`;
  pill.replaceChildren(statusIcon(d.problems.length ? "critical" : "good"), d.problems.length ? `${d.problems.length} problem${d.problems.length > 1 ? "s" : ""}` : "All working");
  pill.title = d.problems.join(", ") || "Every check passes";
  pill.href = `/?range=${range}`;
  const overviewTab = document.querySelector('#tabs a[data-page="overview"]');
  overviewTab.querySelector(".dot")?.remove();
  if (d.problems.length) overviewTab.append(h("span", { class: "dot", "aria-label": `${d.problems.length} problems` }));
  document.title = `${d.problems.length ? `(${d.problems.length}) ` : ""}${PAGE_NAMES[PAGE]} · BSREA Monitoring`;
};

let loading = false;
const load = async () => {
  if (loading) return;
  loading = true;
  $("main").classList.add("loading");
  try {
    const res = await fetch(`/api/page/${PAGE}?range=${range}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (res.status === 401) return location.assign("/login");
    if (!res.ok) throw new Error(`The server answered ${res.status}`);
    data = await res.json();
    render(data);
    $("updated").textContent = `Updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())} · refreshes every minute`;
  } catch (error) {
    $("updated").textContent = `Could not refresh: ${error.message}. Retrying…`;
  } finally {
    loading = false;
    $("main").classList.remove("loading");
  }
};

const setRange = (key) => {
  range = key;
  store.set("range", key);
  history.replaceState(null, "", `${location.pathname}?range=${key}`);
  document.querySelectorAll("#ranges button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === key)));
  // Switching page keeps the period
  document.querySelectorAll("#tabs a").forEach((a) => (a.href = `${a.getAttribute("href").split("?")[0]}?range=${key}`));
  load();
};

document.querySelectorAll("#ranges button").forEach((b) => b.addEventListener("click", () => setRange(b.dataset.range)));
$("refresh").addEventListener("click", load);
$("theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  store.set("theme", document.documentElement.dataset.theme);
});
$("test-alert").addEventListener("click", async () => {
  const res = await fetch("/api/test-alert", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  toast(body.message ?? body.error ?? "Could not send the test alert");
});

/* ---------- This page: show its sections and mark its tab ---------- */
document.querySelectorAll("main > section").forEach((s) => (s.hidden = s.dataset.page !== PAGE));
document.querySelectorAll("#tabs a").forEach((a) => { if (a.dataset.page === PAGE) a.setAttribute("aria-current", "page"); });
document.querySelector('#tabs a[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });

const savedTheme = store.get("theme");
if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;

let resizeTimer;
let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => data && renderCharts(data), 150);
});
setInterval(() => { if (!document.hidden) load(); }, 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && data && Date.now() / 1000 - data.generatedAt > 60) load(); });

setRange(range);
