#!/usr/bin/env bash
# Build BSREA on this computer and send it to the server, then restart the apps there.
#
#   deploy/push.sh ubuntu@SERVER_IP
#   SITE_URL=https://bsrea-demo.duckdns.org DEMO_MODE=1 deploy/push.sh ubuntu@SERVER_IP   (demo copy)
#
# SITE_URL is the public website address (default https://bsreabd.org). DEMO_MODE=1 builds the demo
# copy: a "not the official website" banner on every page, hidden from search engines.
#
# The websites are built here (a small 1 GB server does not have the memory to build them) into
# .next-prod folders, so a dev server running on this computer is not disturbed. Only code and the
# finished builds are copied: never .env files, the database, uploaded documents, backups or the
# private member list (see deploy/rsync-exclude.txt). Files that only exist on the server stay there.
set -euo pipefail

SERVER=${1:?"usage: deploy/push.sh ubuntu@SERVER_IP"}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP=/srv/bsrea
SITE_URL=${SITE_URL:-https://bsreabd.org}
DEMO_MODE=${DEMO_MODE:-0}
cd "$ROOT"

echo "== Building the API"
(cd backend && npm run -s build)

echo "== Building the public website"
# An empty API address: the browser calls /api on the same website, and nginx passes it to the API.
(cd client && NEXT_DIST_DIR=.next-prod NEXT_PUBLIC_API_URL= NEXT_PUBLIC_SITE_URL="$SITE_URL" NEXT_PUBLIC_DEMO_MODE="$DEMO_MODE" npx next build)

echo "== Building the staff panel"
(cd admin && NEXT_DIST_DIR=.next-prod NEXT_PUBLIC_API_URL= NEXT_PUBLIC_SITE_URL="$SITE_URL" npx next build)

for app in client admin; do
  if grep -rqs "localhost:3002" "$app/.next-prod/static"; then
    echo "Stopped: the $app build still points at localhost:3002" >&2
    exit 1
  fi
done

echo "== Copying the code"
rsync -az --delete --exclude-from=deploy/rsync-exclude.txt ./ "$SERVER:$APP/"
for app in client admin; do
  rsync -az --delete --exclude cache/ "$app/.next-prod/" "$SERVER:$APP/$app/.next-prod/"
done

echo "== Installing packages and restarting on the server"
ssh "$SERVER" "set -e; cd $APP
  (cd backend && npm ci --no-audit --no-fund --loglevel=error)
  # Full install: 'next start' needs TypeScript to read next.config.ts
  (cd client && npm ci --no-audit --no-fund --loglevel=error)
  (cd admin && npm ci --no-audit --no-fund --loglevel=error)
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save >/dev/null
  pm2 status"
