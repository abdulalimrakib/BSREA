// Small SVG chart kit for the dashboard: line, column, sparkline and table view. No libraries.
// Marks follow one spec: 2px lines, 24px-max columns with a 4px rounded top, 2px gaps between stacked parts,
// recessive hairline grid, a legend for 2+ series, a hover/keyboard tooltip, and a table view of every chart.
// Colours are CSS variables, so switching light/dark needs no redraw. Text is always set with textContent,
// and styles through element.style (the strict Content-Security-Policy blocks style attributes).

const NS = "http://www.w3.org/2000/svg";

export const svg = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    // Styles go through the CSS object model: the page's Content-Security-Policy blocks style attributes
    if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, String(v));
  }
  parent?.appendChild(node);
  return node;
};

export const h = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};

/* ---------- Number and time formats ---------- */
export const fmt = {
  int: (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-US")),
  compact: (v) => {
    if (v == null) return "–";
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
    if (a >= 1e4) return `${(v / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
    return Math.round(v).toLocaleString("en-US");
  },
  pct: (v, digits = 0) => (v == null ? "–" : `${v.toFixed(digits)}%`),
  ms: (v) => (v == null ? "–" : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} s` : `${Math.round(v)} ms`),
  bytes: (v) => {
    if (v == null) return "–";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (Math.abs(v) >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
  },
  duration: (sec) => {
    if (sec == null) return "–";
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min`;
    if (sec < 86400 * 2) return `${Math.round(sec / 3600)} h`;
    return `${Math.round(sec / 86400)} days`;
  },
};

const dtf = (opts) => new Intl.DateTimeFormat("en-GB", opts);
const F = {
  hm: dtf({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  dayShort: dtf({ weekday: "short", day: "numeric" }),
  dayMonth: dtf({ day: "numeric", month: "short" }),
  full: dtf({ weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  day: dtf({ weekday: "short", day: "numeric", month: "short", year: "numeric" }),
};
export const timeTick = (sec, span) => {
  const d = new Date(sec * 1000);
  if (span <= 2 * 86400) return F.hm.format(d);
  if (span <= 8 * 86400) return F.dayShort.format(d);
  return F.dayMonth.format(d);
};
export const timeLong = (sec, step) => {
  const d = new Date(sec * 1000);
  if (step >= 86400) return F.day.format(d);
  if (step > 60) return `${F.full.format(d)} – ${F.hm.format(new Date((sec + step) * 1000))}`;
  return F.full.format(d);
};
export const formatDay = (day) => F.day.format(new Date(`${day}T12:00:00`));

/* ---------- Axis scale ---------- */
const niceStep = (raw) => {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};
export const niceTicks = (max, count = 4) => {
  if (!(max > 0)) return [0, 1];
  const step = niceStep(max / count);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
};

/* ---------- Shared pieces ---------- */
const legend = (series, kind) =>
  h("div", { class: "legend", "aria-hidden": "true" }, series.map((s) => h("span", {}, h("i", { class: kind === "line" ? "key-line" : "key-box", style: `background:${s.color}` }), s.name)));

const tooltipEl = (host) => {
  const tip = h("div", { class: "tooltip", role: "status" });
  host.append(tip);
  return tip;
};

const placeTip = (host, tip, x, y) => {
  const w = tip.offsetWidth;
  const hostW = host.clientWidth;
  let left = x + 14;
  if (left + w > hostW) left = x - w - 14;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${Math.max(0, y - 10)}px`;
};

const fillTip = (tip, title, rows) => {
  tip.replaceChildren(
    h("div", { class: "when", text: title }),
    ...rows.map((r) => h("div", { class: "row" }, h("span", { class: "name" }, r.color ? h("i", { class: r.box ? "key-box" : "key-line", style: `background:${r.color}` }) : null, r.name), h("strong", { text: r.value }))),
  );
};

export const emptyState = (host, text) => host.replaceChildren(h("div", { class: "empty", text }));

/* ---------- Table view (every chart can be read without colour or hover) ---------- */
export const seriesTable = ({ t, step, series, format, labels }) => {
  const rows = (labels ?? t).map((_, i) => i).filter((i) => series.some((s) => s.values[i] != null));
  const body = rows.reverse().map((i) => h("tr", {}, h("td", { text: labels ? labels[i] : timeLong(t[i], step) }), series.map((s) => h("td", { class: "n", text: format(s.values[i]) }))));
  return h("div", { class: "table-wrap", style: "max-height:300px" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: labels ? "Day" : "Time" }), series.map((s) => h("th", { class: "n", text: s.name })))), h("tbody", {}, body)));
};

/* ---------- Line chart with crosshair ---------- */
// opts: { t, step, series: [{ name, values, color }], format, max?, ref?: { value, label }, area?, height?, label }
export const lineChart = (host, opts) => {
  const { t, series, format, step } = opts;
  host.replaceChildren();
  host.classList.add("chart");
  if (!t.length || series.every((s) => s.values.every((v) => v == null))) return emptyState(host, opts.empty ?? "No data for this period yet");
  if (series.length > 1) host.append(legend(series, "line"));

  const width = Math.max(260, host.clientWidth);
  const height = opts.height ?? 220;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values.filter((v) => v != null)), opts.ref?.value ?? 0);
  // Byte charts get round ticks in their own unit (0, 5, 10 GB rather than 4.7, 9.3 GB)
  const unit = opts.binary ? 1024 ** Math.max(0, Math.floor(Math.log(Math.max(1, dataMax)) / Math.log(1024))) : 1;
  const ticks = opts.max != null ? niceTicks(opts.max, 4) : niceTicks((dataMax * 1.08) / unit || 1, 4).map((v) => v * unit);
  const yMax = ticks.at(-1);
  const tickText = ticks.map((v) => format(v));
  const left = Math.max(28, Math.max(...tickText.map((s) => s.length)) * 6.6 + 10);
  const top = 10, right = 14, bottom = 26;
  const plotW = width - left - right, plotH = height - top - bottom;
  const n = t.length;
  const x = (i) => left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => top + plotH - (Math.min(v, yMax) / yMax) * plotH;

  const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", tabindex: 0, "aria-label": `${opts.label ?? "Chart"}. Use the arrow keys to read values.` });
  ticks.forEach((v, i) => {
    svg("line", { x1: left, x2: width - right, y1: y(v), y2: y(v), style: `stroke:${i === 0 ? "var(--axis)" : "var(--grid)"}`, "stroke-width": 1, "shape-rendering": "crispEdges" }, root);
    svg("text", { x: left - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-label" }, root).textContent = tickText[i];
  });
  const span = t[n - 1] - t[0] + step;
  const labelCount = Math.max(2, Math.min(n, Math.floor(plotW / 86)));
  for (let k = 0; k < labelCount; k++) {
    const i = Math.round((k * (n - 1)) / (labelCount - 1));
    svg("text", { x: x(i), y: height - 6, "text-anchor": k === 0 ? "start" : k === labelCount - 1 ? "end" : "middle", class: "axis-label" }, root).textContent = timeTick(t[i], span);
  }
  if (opts.ref) {
    svg("line", { x1: left, x2: width - right, y1: y(opts.ref.value), y2: y(opts.ref.value), style: "stroke:var(--critical)", "stroke-width": 1, opacity: 0.6 }, root);
    svg("text", { x: width - right, y: y(opts.ref.value) - 5, "text-anchor": "end", class: "axis-label" }, root).textContent = opts.ref.label;
  }

  for (const s of series) {
    // Split into runs without gaps: missing data is shown as a gap, never as zero
    let run = [];
    const runs = [];
    s.values.forEach((v, i) => {
      if (v == null) { if (run.length) runs.push(run); run = []; } else run.push(i);
    });
    if (run.length) runs.push(run);
    for (const r of runs) {
      if (r.length === 1) { svg("circle", { cx: x(r[0]), cy: y(s.values[r[0]]), r: 2.5, style: `fill:${s.color}` }, root); continue; }
      const d = r.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(s.values[i]).toFixed(1)}`).join("");
      if (opts.area && series.length === 1) svg("path", { d: `${d}L${x(r.at(-1)).toFixed(1)},${y(0)}L${x(r[0]).toFixed(1)},${y(0)}Z`, style: `fill:${s.color}`, "fill-opacity": 0.1 }, root);
      svg("path", { d, fill: "none", style: `stroke:${s.color}`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, root);
    }
  }

  // Hover layer: crosshair snaps to the nearest time, one tooltip lists every series
  const cross = svg("line", { y1: top, y2: top + plotH, style: "stroke:var(--axis)", "stroke-width": 1, visibility: "hidden" }, root);
  const dots = series.map((s) => svg("circle", { r: 4.5, style: `fill:${s.color};stroke:var(--surface)`, "stroke-width": 2, visibility: "hidden" }, root));
  const hit = svg("rect", { x: left, y: top, width: plotW, height: plotH, fill: "transparent" }, root);
  host.append(root);
  const tip = tooltipEl(host);
  let current = -1;
  const show = (i) => {
    current = Math.max(0, Math.min(n - 1, i));
    const cx = x(current);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    let topY = top + plotH;
    series.forEach((s, k) => {
      const v = s.values[current];
      if (v == null) { dots[k].setAttribute("visibility", "hidden"); return; }
      dots[k].setAttribute("cx", cx); dots[k].setAttribute("cy", y(v)); dots[k].setAttribute("visibility", "visible");
      topY = Math.min(topY, y(v));
    });
    fillTip(tip, timeLong(t[current], step), series.map((s) => ({ name: s.name, value: s.values[current] == null ? "no data" : format(s.values[current]), color: s.color })));
    tip.classList.add("show");
    placeTip(host, tip, cx, root.getBoundingClientRect().top - host.getBoundingClientRect().top + topY);
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); tip.classList.remove("show"); };
  hit.addEventListener("pointermove", (e) => {
    const r = root.getBoundingClientRect();
    show(Math.round(((e.clientX - r.left - left) / plotW) * (n - 1)));
  });
  hit.addEventListener("pointerleave", hide);
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(current < 0 ? n - 1 : current + (e.key === "ArrowRight" ? 1 : -1)); }
    if (e.key === "Escape") hide();
  });
  root.addEventListener("blur", hide);
};

/* ---------- Column chart (stacked when several series) ---------- */
const roundedTop = (x, y, w, hgt, r) => {
  r = Math.min(r, hgt, w / 2);
  return `M${x},${y + hgt}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + hgt}Z`;
};

// opts: { labels: [string], titles?: [string], series: [{ name, values, color }], format, height?, label }
export const columnChart = (host, opts) => {
  const { labels, series, format } = opts;
  host.replaceChildren();
  host.classList.add("chart");
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  if (!labels.length || totals.every((v) => !v)) return emptyState(host, opts.empty ?? "Nothing recorded in this period");
  if (series.length > 1) host.append(legend(series, "box"));

  const width = Math.max(260, host.clientWidth);
  const height = opts.height ?? 200;
  const ticks = niceTicks(Math.max(...totals) * 1.08, 4);
  const yMax = ticks.at(-1);
  const tickText = ticks.map(format);
  const left = Math.max(28, Math.max(...tickText.map((s) => s.length)) * 6.6 + 10);
  const top = 10, right = 8, bottom = 26;
  const plotW = width - left - right, plotH = height - top - bottom;
  const n = labels.length;
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(24, slot * 0.68));
  const y = (v) => top + plotH - (v / yMax) * plotH;

  const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", tabindex: 0, "aria-label": `${opts.label ?? "Chart"}. Use the arrow keys to read values.` });
  ticks.forEach((v, i) => {
    svg("line", { x1: left, x2: width - right, y1: y(v), y2: y(v), style: `stroke:${i === 0 ? "var(--axis)" : "var(--grid)"}`, "stroke-width": 1, "shape-rendering": "crispEdges" }, root);
    svg("text", { x: left - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-label" }, root).textContent = tickText[i];
  });
  const labelEvery = Math.max(1, Math.ceil(n / Math.floor(plotW / 64)));
  for (let i = n - 1; i >= 0; i -= labelEvery)
    svg("text", { x: left + slot * i + slot / 2, y: height - 6, "text-anchor": "middle", class: "axis-label" }, root).textContent = labels[i];

  const tip = tooltipEl(host);
  const groups = [];
  let current = -1;
  const show = (i) => {
    current = Math.max(0, Math.min(n - 1, i));
    groups.forEach((g, k) => g.classList.toggle("active", k === current));
    const rows = series.map((s) => ({ name: s.name, value: format(s.values[current] ?? 0), color: s.color, box: true }));
    if (series.length > 1) rows.push({ name: "Total", value: format(totals[current]) });
    fillTip(tip, opts.titles?.[current] ?? labels[current], rows);
    tip.classList.add("show");
    placeTip(host, tip, left + slot * current + slot / 2, root.getBoundingClientRect().top - host.getBoundingClientRect().top + y(totals[current]));
  };
  const hide = () => { tip.classList.remove("show"); groups.forEach((g) => g.classList.remove("active")); };

  for (let i = 0; i < n; i++) {
    const g = svg("g", { class: "mark-hover" }, root);
    groups.push(g);
    const bx = left + slot * i + (slot - barW) / 2;
    let base = 0;
    const parts = series.map((s) => ({ v: s.values[i] ?? 0, color: s.color })).filter((p) => p.v > 0);
    parts.forEach((p, k) => {
      const y0 = y(base), y1 = y(base + p.v);
      const gap = k > 0 ? 2 : 0; // surface gap between stacked parts
      const hgt = Math.max(1, y0 - y1 - gap);
      const isTop = k === parts.length - 1;
      svg("path", { d: isTop ? roundedTop(bx, y1, barW, hgt, 4) : `M${bx},${y1}h${barW}v${hgt}h${-barW}Z`, style: `fill:${p.color}` }, g);
      base += p.v;
    });
    // The whole column slot is the hover target, not just the painted bar
    const hitRect = svg("rect", { x: left + slot * i, y: top, width: slot, height: plotH, fill: "transparent" }, g);
    hitRect.addEventListener("pointerenter", () => show(i));
  }
  root.addEventListener("pointerleave", hide);
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(current < 0 ? n - 1 : current + (e.key === "ArrowRight" ? 1 : -1)); }
    if (e.key === "Escape") hide();
  });
  root.addEventListener("blur", hide);
  host.append(root);
};

/* ---------- Sparkline for stat tiles ---------- */
export const sparkline = (values, color = "var(--s1)") => {
  const points = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  const root = svg("svg", { class: "spark", viewBox: "0 0 100 30", preserveAspectRatio: "none", "aria-hidden": "true" });
  if (points.length < 2) return root;
  const max = Math.max(...points.map(([, v]) => v)) || 1;
  const n = values.length - 1 || 1;
  const d = points.map(([i, v], k) => `${k ? "L" : "M"}${((i / n) * 100).toFixed(2)},${(28 - (v / max) * 26).toFixed(2)}`).join("");
  svg("path", { d: `${d}L100,30L0,30Z`, style: `fill:${color}`, "fill-opacity": 0.1 }, root);
  svg("path", { d, fill: "none", style: `stroke:${color}`, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }, root);
  return root;
};
