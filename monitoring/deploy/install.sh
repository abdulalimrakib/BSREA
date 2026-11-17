#!/usr/bin/env bash
# Set up the monitoring dashboard on the BSREA server. Run from the monitoring folder, as the user that runs the apps:
#
#   cd /srv/bsrea/monitoring && bash deploy/install.sh monitor.bsrea-demo.duckdns.org
#
# Safe to run again. It never changes the BSREA apps or their nginx site; it only adds:
#   /etc/nginx/conf.d/bsrea-logging.conf       a log nginx writes for the dashboard
#   /etc/nginx/conf.d/bsrea-protection.conf    rate limits, blocked addresses, slow-connection limits
#   /etc/nginx/sites-available/bsrea-monitor   the dashboard's own address
#   /etc/logrotate.d/bsrea-monitoring          keeps the PM2 and BSREA logs from filling the disk
#   the PM2 app "bsrea-monitor"
set -euo pipefail

DOMAIN=${1:?"usage: bash deploy/install.sh monitor.your-domain"}
HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$HERE"

echo "== Node.js 24 or newer"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 24 ]; then echo "Node.js $NODE_MAJOR found; 24 or newer is needed (see deploy/setup-server.sh)" >&2; exit 1; fi

echo "== Settings"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo "   Created monitoring/.env: put your alert address (ALERT_WEBHOOK_URL) in it"
fi
mkdir -p data && chmod 700 data

echo "== nginx: request log, attack protection, and the dashboard's address ($DOMAIN)"
# The block list nginx reads must exist (empty at first); the dashboard keeps it up to date
[ -f data/blocklist.map ] || printf '# Written by BSREA monitoring\n' > data/blocklist.map
chmod 644 data/blocklist.map
# Each file is tested before nginx reloads; if nginx rejects it, it is taken out again, so the sites never go down
try_conf() {
  sudo cp "$1" "$2"
  if ! sudo nginx -t 2>/tmp/bsrea-nginx-test.log; then
    sudo rm -f "$2"
    cat /tmp/bsrea-nginx-test.log >&2
    echo "nginx did not accept $1: removed it again, nothing changed" >&2
    exit 1
  fi
}
try_conf deploy/nginx-logging.conf /etc/nginx/conf.d/bsrea-logging.conf
try_conf deploy/nginx-protection.conf /etc/nginx/conf.d/bsrea-protection.conf
if [ ! -f /etc/nginx/sites-available/bsrea-monitor ]; then
  # Only the first time: certbot adds HTTPS to this file afterwards, so it is not overwritten again
  sed "s/MONITOR_DOMAIN/$DOMAIN/g" deploy/nginx-monitor.conf | sudo tee /etc/nginx/sites-available/bsrea-monitor >/dev/null
fi
sudo ln -sf /etc/nginx/sites-available/bsrea-monitor /etc/nginx/sites-enabled/bsrea-monitor
sudo nginx -t
sudo systemctl reload nginx

echo "== Log access and rotation"
# Let this user read the nginx logs through an ACL: works straight away (no restart of PM2 or the apps),
# and the default ACL carries over to the new files logrotate creates
command -v setfacl >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y acl
sudo setfacl -m "u:$USER:rx" /var/log/nginx
sudo setfacl -d -m "u:$USER:r" /var/log/nginx
sudo find /var/log/nginx -name 'bsrea.access.log*' -exec setfacl -m "u:$USER:r" {} +
sudo tee /etc/logrotate.d/bsrea-monitoring >/dev/null <<LOGROTATE
/home/$USER/.pm2/logs/*.log /srv/bsrea/backend/storage/*.log {
  weekly
  rotate 8
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
  su $USER $USER
}
LOGROTATE

echo "== Start the dashboard"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save >/dev/null

echo
echo "Done. Next:"
echo "  1. DNS: point $DOMAIN to this server (an A record, like the main site)"
echo "  2. HTTPS: sudo certbot --nginx -d $DOMAIN"
echo "  3. Password: npm run set-password"
echo "  4. Alerts: put ALERT_WEBHOOK_URL in monitoring/.env, then: pm2 reload bsrea-monitor && npm run test-alert"
echo "  5. Open https://$DOMAIN"
