/*--Restore a backup made by "npm run backup". STOP THE SERVER FIRST.

    npm run restore -- <backup folder>

  The backup is checked before anything is touched. The current database (if any) is kept
  beside it as bsrea.db.before-restore-<time>, not deleted. Needs the same ENCRYPTION_KEY
  the backup was made with.--*/

import path from "path";
import { restoreBackup } from "../services/backup";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: npm run restore -- <backup folder>");
  process.exit(1);
}

try {
  const { counts, keptAs } = restoreBackup(path.resolve(folder));
  console.log("Restored.");
  for (const [table, n] of Object.entries(counts))
    console.log(`  ${table}: ${n}`);
  if (keptAs) console.log(`The previous database was kept as ${keptAs}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
