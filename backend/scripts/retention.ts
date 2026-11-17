/*--Delete what is no longer needed (run daily, e.g. from cron after the backup):
  - documents of rejected applications, RETENTION_DAYS (default 180) after the decision
  - expired staff sessions and old login-failure records

    npm run retention             delete
    npm run retention -- --dry    only count what would be deleted

  Prints counts only.--*/

import { db } from "../db/database";
import { purgeExpired } from "../services/retention";

const dryRun = process.argv.includes("--dry");
const result = purgeExpired(db, { dryRun });
console.log(
  `${dryRun ? "Would delete" : "Deleted"}: ${result.applications} rejected application(s) - ${result.documents} document(s); ${result.sessions} expired session(s); ${result.loginFailures} old login-failure record(s)`,
);
