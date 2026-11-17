import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../db.ts";
import { minuteOf, nowSec } from "../time.ts";

/*--The apps PM2 runs (bsrea-api, bsrea-site, bsrea-admin, and this dashboard): status, memory, CPU, restarts--*/

export type AppInfo = { name: string; status: string; cpu: number; mem: number; restarts: number; uptime: number; memLimit: number | null };

const run = promisify(execFile);

export const readApps = async (): Promise<AppInfo[] | null> => {
  try {
    const { stdout } = await run("pm2", ["jlist"], { timeout: 20_000, maxBuffer: 16 * 1024 * 1024 });
    // pm2 can print a warning line before the JSON
    const list = JSON.parse(stdout.slice(stdout.indexOf("["))) as {
      name: string;
      pm2_env: { status: string; restart_time: number; pm_uptime: number; max_memory_restart?: number };
      monit: { memory: number; cpu: number };
    }[];
    return list.map((app) => ({
      name: app.name,
      status: app.pm2_env.status,
      cpu: app.monit.cpu,
      mem: app.monit.memory,
      restarts: app.pm2_env.restart_time,
      uptime: app.pm2_env.status === "online" ? Math.floor((Date.now() - app.pm2_env.pm_uptime) / 1000) : 0,
      memLimit: app.pm2_env.max_memory_restart ?? null,
    }));
  } catch {
    return null; // PM2 isn't installed here (a developer's computer)
  }
};

export const saveApps = (apps: AppInfo[], at = nowSec()) => {
  const insert = db.prepare(`INSERT OR REPLACE INTO apps VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const app of apps) insert.run(minuteOf(at), app.name, app.status, app.cpu, app.mem, app.restarts, app.uptime);
};

/*--Restarts since the previous record, per app (a deploy reloads every app once, so 1 after a deploy is normal)--*/
export const previousRestarts = (app: string, before: number) =>
  (db.prepare(`SELECT restarts FROM apps WHERE app = ? AND ts < ? ORDER BY ts DESC LIMIT 1`).get(app, before) as { restarts: number } | undefined)?.restarts;
