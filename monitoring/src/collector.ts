import { config } from "./config.ts";
import { db } from "./db.ts";
import { recordChecks, sendAlert } from "./alerts.ts";
import { saveBusiness } from "./collect/business.ts";
import { runChecks, saveResults } from "./collect/checks.ts";
import { readNewLines, setObserver } from "./collect/nginx.ts";
import { assess, observe, refreshAllowed } from "./security.ts";
import { saveSample, takeSample } from "./collect/system.ts";
import { dayKey, nowSec } from "./time.ts";

/*--Runs inside the dashboard process, so there is nothing to put in cron:
    every minute    server sample, new nginx log lines, attack check (detect, judge, block)
    every 5 minutes checks (sites, certificates, apps, disk, memory, backup, errors) and alerts
    every hour      membership counts and data sizes
    every night     old detail deleted (hourly and daily totals stay)
  A failing step is logged and retried next time; it never stops the others or the dashboard.--*/

export const status = { lastLogProblem: undefined as string | undefined, lastRun: 0, running: false };

const step = async (name: string, work: () => unknown) => {
  try {
    await work();
  } catch (error) {
    console.error(`[collector] ${name} failed:`, error instanceof Error ? error.message : error);
  }
};

export const prune = (now = nowSec()) => {
  const cutoff = now - config.KEEP_MINUTES_DAYS * 86400;
  db.prepare(`DELETE FROM traffic_min WHERE ts < ?`).run(cutoff);
  db.prepare(`DELETE FROM system_min WHERE ts < ?`).run(cutoff);
  db.prepare(`DELETE FROM apps WHERE ts < ?`).run(now - 90 * 86400);
  db.prepare(`DELETE FROM check_result WHERE ts < ?`).run(now - 400 * 86400);
  db.prepare(`DELETE FROM alerts WHERE ts < ?`).run(now - 400 * 86400);
  db.prepare(`DELETE FROM pages_day WHERE day < ?`).run(dayKey(now - 400 * 86400));
  db.prepare(`DELETE FROM routes_day WHERE day < ?`).run(dayKey(now - 400 * 86400));
  // Visitor hashes are only needed for today's count (yesterday kept for late log lines)
  db.prepare(`DELETE FROM visitor_seen WHERE day < ?`).run(dayKey(now - 2 * 86400));
  db.prepare(`DELETE FROM sessions WHERE expires < ?`).run(now);
  // A block's address is forgotten a day after it ends (the history keeps it masked)
  db.prepare(`DELETE FROM bans WHERE until < ?`).run(now - 86400);
  db.prepare(`DELETE FROM ban_log WHERE ts < ?`).run(now - 400 * 86400);
  db.prepare(`DELETE FROM security_events WHERE start < ?`).run(now - 400 * 86400);
};

export const tick = async (now = new Date()) => {
  if (status.running) return; // the previous run is still going (slow checks)
  status.running = true;
  try {
    const minute = now.getUTCMinutes();
    await step("server sample", () => {
      const sample = takeSample();
      if (sample) saveSample(sample);
    });
    await step("nginx log", () => {
      status.lastLogProblem = readNewLines().problem;
    });
    // Every minute, so an attack that hurts visitors is reported within a minute or two
    await step("attack check", async () => {
      const { checks } = await assess();
      await sendAlert(recordChecks(checks));
    });
    if (minute % 5 === 0) {
      await step("checks", async () => {
        const checks = await runChecks();
        saveResults(checks);
        await sendAlert(recordChecks(checks));
      });
    }
    if (minute === 7) {
      await step("membership counts", () => saveBusiness());
      await step("allowed addresses", () => refreshAllowed());
    }
    if (minute === 13 && now.getUTCHours() === 21) await step("clean-up", () => prune()); // 03:13 in Dhaka
    status.lastRun = nowSec();
  } finally {
    status.running = false;
  }
};

/*--Start: prime the counters now, then run at the start of every minute--*/
export const startCollector = () => {
  setObserver(observe);
  void step("allowed addresses", () => refreshAllowed());
  takeSample();
  void step("first membership count", () => saveBusiness());
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), 60_000);
  }, 60_000 - (Date.now() % 60_000) + 2_000);
  // First checks straight away, so the dashboard isn't empty after a restart
  setTimeout(() => void step("first checks", async () => {
    const checks = await runChecks();
    saveResults(checks);
    await sendAlert(recordChecks(checks));
  }), 5_000);
};
