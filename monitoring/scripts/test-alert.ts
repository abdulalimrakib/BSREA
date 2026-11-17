/*--Send a test alert to ALERT_WEBHOOK_URL, to check that alerts reach your phone.

    npm run test-alert--*/

import os from "node:os";
import { config } from "../src/config.ts";
import { deliver } from "../src/alerts.ts";

if (!config.ALERT_WEBHOOK_URL) {
  console.error("ALERT_WEBHOOK_URL is not set in monitoring/.env");
  process.exit(1);
}
const ok = await deliver("BSREA test alert", `Alerts from ${os.hostname()} reach you. Nothing is wrong.`, false);
console.log(ok ? "Test alert sent" : "The alert service did not accept the message: check ALERT_WEBHOOK_URL");
process.exit(ok ? 0 : 1);
