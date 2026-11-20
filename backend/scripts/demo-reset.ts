/*--Start a demo again from a clean slate (docs/demo-kit/README.md).

    npm run demo-reset -- --confirm

  Deletes the demo applications, their documents, certificates and certificate checks, and puts back the
  40 demo members. It refuses to run if any member or application is NOT a demo company (a name starting
  with "Demo "), so it can never delete real data. Staff accounts and the audit log are kept.
  Afterwards restart the API (pm2 restart bsrea-api) so the per-hour application limit starts again too.--*/

import { db } from "../db/database";
import { realCompanies, replaceWithDemoData } from "../services/demo";

const real = realCompanies();
if (real.length) {
  console.error(`Stopped: this database holds ${real.length} compan${real.length === 1 ? "y" : "ies"} that are not demo data (names not starting with "Demo ").`);
  console.error(`demo-reset only runs on a demo copy. To turn a copy into a demo copy, use "npm run demo-data -- --confirm" (it deletes everything).`);
  process.exit(1);
}
if (!process.argv.includes("--confirm")) {
  console.log("This deletes the demo applications and certificates and puts back the 40 demo members.");
  console.log("Run it again with --confirm to go ahead.");
  process.exit(0);
}

const deleted = replaceWithDemoData(40);
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
console.log(
  `Demo reset: deleted ${deleted.applications} application(s), ${deleted.documents} document(s), ${deleted.certificates} certificate(s) and ${deleted.certificateChecks} certificate check(s); 40 demo members are back.`,
);
console.log("Now restart the API so the application limit starts again: pm2 restart bsrea-api (or restart npm run dev).");
