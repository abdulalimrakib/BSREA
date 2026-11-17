import { config } from "./config.ts";
import { db } from "./db.ts";
import type { Check } from "./collect/checks.ts";
import { nowSec } from "./time.ts";

/*--Alerts: one message when something breaks, a reminder every ALERT_REMIND_HOURS while it stays broken,
  and one when it is fixed. Never every 5 minutes. Every alert is also listed on the dashboard.--*/

export type Change = Check & { change: "broken" | "fixed" | "still broken" };

/*--Save the checks' state; return what changed enough to tell someone--*/
export const recordChecks = (checks: Check[], at = nowSec()) => {
  const get = db.prepare(`SELECT ok, since, alerted FROM check_state WHERE name = ?`);
  const save = db.prepare(`INSERT OR REPLACE INTO check_state VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const changes: Change[] = [];
  for (const c of checks) {
    const state = get.get(c.name) as { ok: number; since: number; alerted: number | null } | undefined;
    const changed = !state || Boolean(state.ok) !== c.ok;
    let alerted = state?.alerted ?? null;
    // A check seen for the first time only alerts when it is failing
    if (changed && (state || !c.ok)) {
      changes.push({ ...c, change: c.ok ? "fixed" : "broken" });
      alerted = at;
    } else if (!c.ok && (!alerted || at - alerted >= config.ALERT_REMIND_HOURS * 3600)) {
      changes.push({ ...c, change: "still broken" });
      alerted = at;
    }
    save.run(c.name, c.label, c.ok ? 1 : 0, c.detail, c.hint ?? null, changed ? at : state!.since, at, alerted);
  }
  // Forget checks that stopped running (an app removed from PM2); their results stay for the charts
  db.prepare(`DELETE FROM check_state WHERE checked < ?`).run(at - 15 * 60);
  return changes;
};

export const describe = (changes: Change[]) => {
  const broken = changes.filter((c) => c.change !== "fixed");
  const title = broken.length ? `BSREA: ${broken.length} problem${broken.length > 1 ? "s" : ""}` : "BSREA: back to normal";
  const word = { broken: "PROBLEM", "still broken": "STILL A PROBLEM", fixed: "FIXED" };
  const body = changes.map((c) => `${word[c.change]}: ${c.label}. ${c.detail}${c.hint && c.change !== "fixed" ? `\n  What to do: ${c.hint}` : ""}`).join("\n");
  return { title, body, level: broken.length ? "problem" : "fixed" };
};

/*--Deliver to ntfy.sh (plain text), Discord or Slack (JSON). Returns whether it was delivered.--*/
export const deliver = async (title: string, body: string, urgent: boolean, url = config.ALERT_WEBHOOK_URL) => {
  if (!url) return false;
  const text = `${title}\n${body}`;
  const init: RequestInit = /discord(app)?\.com\/api\/webhooks/.test(url)
    ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.slice(0, 1900) }) }
    : /hooks\.slack\.com/.test(url)
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }
      : { headers: { Title: title, Priority: urgent ? "high" : "default", Tags: urgent ? "warning" : "white_check_mark" }, body };
  try {
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000), ...init });
    return res.ok;
  } catch {
    return false;
  }
};

export const sendAlert = async (changes: Change[], at = nowSec()) => {
  if (!changes.length) return;
  const { title, body, level } = describe(changes);
  const delivered = await deliver(title, body, level === "problem");
  db.prepare(`INSERT INTO alerts (ts, level, title, body, delivered) VALUES (?, ?, ?, ?, ?)`).run(at, level, title, body, delivered ? 1 : 0);
};
