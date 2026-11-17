/*--PM2 keeps the three BSREA apps running on the server and restarts them after a crash or reboot.

    pm2 start deploy/ecosystem.config.cjs    (from the project folder)
    pm2 save && pm2 startup                  (start again after a reboot)

  Each app listens on 127.0.0.1 only; nginx is the only way in from the internet.
  The apps are started with node directly (not through npm) and with capped memory,
  so all three fit on a small 1 GB server. The API runs the compiled dist/server.js
  ("npm run build" in backend/), and the websites run the .next-prod folders built by deploy/push.sh.--*/

const next = "node_modules/next/dist/bin/next";

module.exports = {
  apps: [
    {
      name: "bsrea-api",
      cwd: "./backend",
      script: "dist/server.js",
      node_args: "--max-old-space-size=192",
      env: { NODE_ENV: "production" },
      max_memory_restart: "250M",
    },
    {
      name: "bsrea-admin",
      cwd: "./admin",
      script: next,
      args: "start -p 3001 -H 127.0.0.1",
      node_args: "--max-old-space-size=160",
      env: { NODE_ENV: "production", NEXT_DIST_DIR: ".next-prod" },
      max_memory_restart: "250M",
    },
    {
      name: "bsrea-site",
      cwd: "./client",
      script: next,
      args: "start -p 3004 -H 127.0.0.1",
      node_args: "--max-old-space-size=192",
      env: { NODE_ENV: "production", NEXT_DIST_DIR: ".next-prod" },
      max_memory_restart: "300M",
    },
  ],
};
