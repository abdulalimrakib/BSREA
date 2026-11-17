#!/usr/bin/env bash
# One-time preparation of a fresh Oracle Cloud Ubuntu 24.04 server for BSREA (ARM Ampere or the small AMD Micro).
# Run as the default "ubuntu" user:   bash setup-server.sh
# Safe to run again: every step checks whether it was already done.
set -euo pipefail

# The ClamAV virus scanner needs about 1 GB of memory by itself, so it is only installed on servers
# with at least 4 GB. Force it with WITH_CLAMAV=1 or skip it with WITH_CLAMAV=0.
MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
WITH_CLAMAV=${WITH_CLAMAV:-$([ "$MEM_MB" -ge 3800 ] && echo 1 || echo 0)}

echo "== Swap (extra memory for building the websites)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "== System updates and packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx rsync iptables-persistent unattended-upgrades \
  certbot python3-certbot-nginx
sudo dpkg-reconfigure -f noninteractive unattended-upgrades   # automatic security updates

echo "== Node.js 24 and PM2"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2

echo "== Firewall: open the website ports (Oracle's Ubuntu image blocks them with iptables)"
# The rules must come before the image's catch-all REJECT rule, so find where that rule is.
for port in 443 80; do
  if ! sudo iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null; then
    REJECT_AT=$(sudo iptables -L INPUT -n --line-numbers | awk '$2=="REJECT"{print $1; exit}')
    sudo iptables -I INPUT "${REJECT_AT:-1}" -p tcp -m state --state NEW --dport "$port" -j ACCEPT
  fi
done
sudo netfilter-persistent save

echo "== Folders: the app, and backups (readable by this user only)"
sudo mkdir -p /srv/bsrea /var/backups/bsrea
sudo chown "$USER": /srv/bsrea /var/backups/bsrea
chmod 700 /var/backups/bsrea

if [ "$WITH_CLAMAV" = 1 ]; then
  echo "== Virus scanner: listen on 127.0.0.1:3310 for the backend"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y clamav-daemon
  CONF=/etc/clamav/clamd.conf
  grep -q '^TCPSocket 3310' "$CONF" || echo 'TCPSocket 3310' | sudo tee -a "$CONF" >/dev/null
  grep -q '^TCPAddr 127.0.0.1' "$CONF" || echo 'TCPAddr 127.0.0.1' | sudo tee -a "$CONF" >/dev/null
  sudo systemctl enable clamav-daemon
  sudo systemctl restart clamav-daemon || echo "(ClamAV starts once its virus database has downloaded; this can take a few minutes)"
else
  echo "== Virus scanner skipped: this server has ${MEM_MB} MB of memory (needs about 4 GB). Leave CLAMAV_HOST empty in backend/.env."
fi

echo "== Done. Node $(node -v), PM2 $(pm2 -v)"
