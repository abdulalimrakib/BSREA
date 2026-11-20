/*--Replace every member with made-up demo members, for a demo copy of the system.

    npm run demo-data -- --confirm            replaces the members with 40 demo members
    npm run demo-data -- --confirm --count 80

  Real people's details must not sit on a demo server. This deletes ALL members (and any
  applications, documents and certificates, which point at real people too), then adds companies called
  "Demo ... Ltd" with example.com emails and numbers that are not real phone numbers.
  Staff accounts are kept. Delete old backups afterwards: they still contain the previous data.
  Between demos use "npm run demo-reset" instead: it refuses to run while any real data is present.--*/

import { db } from "../db/database";
import { replaceWithDemoData } from "../services/demo";
import { arg } from "./cli";

if (!process.argv.includes("--confirm")) {
  console.log("This deletes ALL members, applications and certificates and adds demo members instead.");
  console.log("Run it again with --confirm to go ahead.");
  process.exit(0);
}

const count = Math.min(Math.max(Number(arg("count")) || 40, 1), 500);
replaceWithDemoData(count);

// Rewrite the database file so the deleted rows are really gone from disk, not just marked as free
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.exec("VACUUM");

console.log(`Members replaced: ${count} demo members. Staff accounts were kept.`);
