/*--PM2 runs the monitoring dashboard as its own app, next to the three BSREA apps (which it does not touch).

    pm2 start ecosystem.config.cjs && pm2 save      (deploy/install.sh does this)
    pm2 reload bsrea-monitor                         (after an update)

  One small process collects and shows everything. Node 24 runs the TypeScript directly: nothing to build.--*/

module.exports = {
  apps: [
    {
      name: "bsrea-monitor",
      cwd: __dirname,
      script: "src/start.ts",
      node_args: "--max-old-space-size=80",
      env: { NODE_ENV: "production" },
      max_memory_restart: "160M",
    },
  ],
};
