/*--Back up the database, documents and contact messages (see services/backup.ts).

    npm run backup                       make a backup, check it, keep the newest BACKUP_KEEP (default 14)
    npm run backup -- --verify           check the newest backup can be restored
    npm run backup -- --verify <folder>  check one backup

  Run it every day, for example from cron:
    15 2 * * *  cd /path/to/backend && npm run backup >> storage/backup.log 2>&1
  and copy BACKUP_DIR to another machine or cloud storage. Prints counts only, never personal data.--*/

import path from "path";
import envConfig from "../config/env.config";
import {
  createBackup,
  listBackups,
  pruneBackups,
  verifyBackup,
} from "../services/backup";

const print = (folder: string, report: ReturnType<typeof verifyBackup>) => {
  console.log(`${path.basename(folder)}: ${report.ok ? "OK" : "PROBLEMS"}`);
  for (const [table, n] of Object.entries(report.counts))
    console.log(`  ${table}: ${n}`);
  for (const problem of report.problems) console.log(`  ! ${problem}`);
};

const main = async () => {
  const verifyIndex = process.argv.indexOf("--verify");
  if (verifyIndex > 0) {
    const folder = process.argv[verifyIndex + 1]
      ? path.resolve(process.argv[verifyIndex + 1])
      : listBackups()[0];
    if (!folder) throw new Error(`No backups found in ${envConfig.BACKUP_DIR}`);
    const report = verifyBackup(folder);
    print(folder, report);
    process.exit(report.ok ? 0 : 1);
  }

  const { db } = await import("../db/database");
  const folder = createBackup(db);
  const report = verifyBackup(folder);
  print(folder, report);
  if (!report.ok) process.exit(1);
  const removed = pruneBackups();
  if (removed.length) console.log(`Removed ${removed.length} old backup(s)`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
