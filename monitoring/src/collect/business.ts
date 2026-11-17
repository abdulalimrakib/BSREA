import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.ts";
import { db } from "../db.ts";
import { dayKey, nowSec } from "../time.ts";

/*--Membership activity and data size, from the backend's database opened READ-ONLY.
  Only counts are read: never a name, number or document.--*/

export const folderSize = (folder: string): number => {
  if (!fs.existsSync(folder)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    try {
      if (entry.isDirectory()) total += folderSize(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    } catch {
      // a file deleted while counting
    }
  }
  return total;
};

export type Business = { members: number; pending: number; applications: number; decided: number; oldestPending: string | null };

export const readBusiness = (file = config.BACKEND_DB): Business | null => {
  if (!fs.existsSync(file)) return null;
  let backend: DatabaseSync | undefined;
  try {
    backend = new DatabaseSync(file, { readOnly: true });
    const today = `${dayKey(nowSec())}`;
    // Stored times are UTC ISO strings; "today" is near enough for a daily count
    const one = (sql: string, ...params: string[]) => (backend!.prepare(sql).get(...params) as { n: number }).n;
    const oldest = backend.prepare(`SELECT MIN(created_at) AS t FROM applications WHERE status IN ('submitted', 'under_review')`).get() as { t: string | null };
    return {
      members: one(`SELECT COUNT(*) AS n FROM members`),
      pending: one(`SELECT COUNT(*) AS n FROM applications WHERE status IN ('submitted', 'under_review')`),
      applications: one(`SELECT COUNT(*) AS n FROM applications WHERE substr(created_at, 1, 10) = ?`, today),
      decided: one(`SELECT COUNT(*) AS n FROM applications WHERE substr(reviewed_at, 1, 10) = ?`, today),
      oldestPending: oldest.t,
    };
  } catch {
    return null; // the backend is being updated, or its layout changed
  } finally {
    backend?.close();
  }
};

/*--Applications received per day, for the chart (counts only)--*/
export const applicationsPerDay = (sinceDay: string, file = config.BACKEND_DB) => {
  if (!fs.existsSync(file)) return null;
  let backend: DatabaseSync | undefined;
  try {
    backend = new DatabaseSync(file, { readOnly: true });
    return backend
      .prepare(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM applications WHERE created_at >= ? GROUP BY day ORDER BY day`)
      .all(sinceDay) as { day: string; n: number }[];
  } catch {
    return null;
  } finally {
    backend?.close();
  }
};

export const saveBusiness = (at = nowSec()) => {
  const b = readBusiness();
  const dbBytes = [config.BACKEND_DB, `${config.BACKEND_DB}-wal`].reduce((sum, f) => sum + (fs.existsSync(f) ? fs.statSync(f).size : 0), 0);
  const docs = folderSize(path.join(config.BACKEND_STORAGE, "documents"));
  const backups = folderSize(config.BACKUP_DIR);
  db.prepare(`INSERT OR REPLACE INTO business_day VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    dayKey(at), b?.members ?? null, b?.pending ?? null, b?.applications ?? null, b?.decided ?? null, dbBytes, docs, backups,
  );
  return b;
};
