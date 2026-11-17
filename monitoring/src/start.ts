/*--Entry point: "npm start", "npm run demo" and PM2 (ecosystem.config.cjs) run this file.
  (PM2 loads scripts through its own wrapper, so server.ts can't tell by itself whether it was started directly.)--*/

import { start } from "./server.ts";

start();
