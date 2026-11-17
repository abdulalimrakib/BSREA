# BSREA Monitoring

A dashboard that watches the BSREA websites, API and server, tells you when something breaks, and shows when the server needs to grow.

It is a separate app in its own folder. It **doesn't change the website, the staff panel or the API**: it watches them from outside, through the nginx log, the server's own counters, PM2, and the membership database opened read-only.

Seven pages, each with its own address. The header shows "All working" or "N problems" on every page:

| Page | What it shows |
| --- | --- |
| **Overview** (`/`) | Whether everything works, every check (green or red, with what to do), the key numbers, and **What to do**: advice on problems, limits and when to scale |
| **Traffic** (`/traffic`) | Page views, visitors per day, most viewed pages. Bots, scanners and prefetches are left out |
| **Performance** (`/performance`) | Response time of pages and API, failed requests, every API route with its speed |
| **Server** (`/server`) | CPU, memory, swap and disk now and over time (with when the disk fills up), network, and the PM2 apps |
| **Security** (`/security`) | Whether there is an attack and whether visitors are affected, blocked addresses (with Unblock), attack history |
| **Uptime & alerts** (`/uptime`) | Up-time per site, a strip showing exactly when anything was down, every alert sent, a test-alert button |
| **Membership** (`/membership`) | Members, applications waiting and per day, database, document and backup size |

Pick the period at the top (last hour to 12 months). The page refreshes every minute, works on a phone, and has light and dark modes. Every chart has a **Table** button that shows its numbers.

## Install on the server (once)

The dashboard gets its own address: **`monitor.bsrea-demo.duckdns.org`**. DuckDNS already sends every name under `bsrea-demo.duckdns.org` to the server, so there is no DNS record to add. (When the site moves to `bsreabd.org`, see "Moving to bsreabd.org" below.)

After the next `deploy/push.sh` (it copies this folder to the server along with everything else):

```bash
cd /srv/bsrea/monitoring
bash deploy/install.sh monitor.bsrea-demo.duckdns.org   # nginx log, dashboard address, log rotation, starts it in PM2
sudo certbot --nginx -d monitor.bsrea-demo.duckdns.org  # HTTPS
npm run set-password                         # the dashboard password (at least 12 characters)
```

Open `https://monitor.bsrea-demo.duckdns.org` and sign in.

**Alerts to your phone.** Install the free **ntfy** app (Android or iPhone) and subscribe to a topic with a long, random name, for example `bsrea-alerts-k7f3q9x2m`. Anyone who knows the name can read the alerts, so don't use an easy one. Then:

```bash
nano /srv/bsrea/monitoring/.env        # ALERT_WEBHOOK_URL=https://ntfy.sh/bsrea-alerts-k7f3q9x2m
pm2 reload bsrea-monitor
npm run test-alert                     # your phone should buzz
```

A Discord or Slack webhook address works too.

**One more free safeguard.** The dashboard runs on the server it watches, so if the whole server goes down it can't send an alert. Add a free check at UptimeRobot or Better Stack on `https://monitor.bsrea-demo.duckdns.org/healthz` and `https://bsrea-demo.duckdns.org` (every 5 minutes, alerts to your email).

## Moving to bsreabd.org

When the website moves to its own domain:

1. In your DNS, add an A record for `monitor.bsreabd.org` pointing to the server.
2. On the server:
   ```bash
   cd /srv/bsrea/monitoring
   sudo rm /etc/nginx/sites-enabled/bsrea-monitor /etc/nginx/sites-available/bsrea-monitor
   bash deploy/install.sh monitor.bsreabd.org
   sudo certbot --nginx -d monitor.bsreabd.org
   ```
3. In `monitoring/.env`, set `SITE_URL=https://bsreabd.org` and `ADMIN_URL=https://admin.bsreabd.org`, then `pm2 reload bsrea-monitor`.

## After each update

`deploy/push.sh` copies the new code but restarts only the three BSREA apps. To restart the dashboard too:

```bash
ssh ubuntu@SERVER "pm2 reload bsrea-monitor"
```

## What alerts look like

You get one message when something breaks, a reminder every 6 hours while it stays broken, and one when it is fixed. Each says what is wrong and what to do:

```
BSREA: 1 problem
PROBLEM: Nightly backup. Last backup 31 hours ago
  What to do: tail /srv/bsrea/backend/storage/backup.log
```

| Check | Every 5 minutes, it is a problem when… |
| --- | --- |
| Public website, Staff panel, API | it doesn't answer, answers with an error, or takes over 5 seconds |
| HTTPS certificate | it expires within 14 days (certbot's automatic renewal failed) |
| Each app | PM2 shows it stopped, or it restarted by itself |
| Disk space | over 85% full |
| Memory | over 90% used and swap half full |
| Nightly backup | no backup in the last 26 hours |
| Real visitors (every minute) | 10% of visitors' requests fail, pages take over 5 seconds, or the CPU is maxed out |
| Attack protection (every minute) | an attack **and** visitors are affected (a blocked attack is not a problem) |

## Security: attacks and real visitors

The rule: **you are warned only when real visitors are affected.** An attack that is stopped while the site works normally is recorded on the Security page and nowhere else: no red, no phone alert.

| What happens | Dashboard | Phone alert |
| --- | --- | --- |
| Nothing unusual | "No attack right now" | none |
| An attack, stopped; visitors fine | "Attack blocked: visitors are not affected" (green shield), listed in Attack history | none |
| An attack, and visitors are affected (site down, errors, very slow, server overloaded) | red: "Under attack: visitors are affected" | yes |
| Visitors are affected, no attack (a crash, a bad deploy) | red: "Real visitors" or the site's own check | yes |

Checked every minute, so an alert comes within 1 to 2 minutes.

**How attacks are stopped** (`deploy/nginx-protection.conf`, plus the dashboard's automatic blocking):

- Each address may make 30 requests a second, with bursts up to 150. People never reach this; floods get "429 Too Many Requests".
- An address is **blocked for 1 hour** (2, 4… up to 24 hours if it comes back) when it does something real visitors never do:
  - asks for files that don't exist on this site, like `.env`, `.php` or `wp-login` (8 times in 10 minutes),
  - gets the staff password wrong 15 times in 10 minutes,
  - makes 1,500 requests in 5 minutes.
- This server, private networks and the addresses in `ALLOW_IPS` are never blocked. If a real person was blocked (several people can share one mobile-network address), press **Unblock** on the Security page.
- Slow-connection attacks are cut off, and nginx no longer advertises its version.
- The API's own limits stay as they were (sign-in lockout, per-address request limits).

**Very large attacks** (thousands of computers at once) can fill the server's internet connection before nginx even sees them; no software on the server can stop that. The dashboard will warn you, because visitors will be affected. The fix is free: put the site behind **Cloudflare** (free plan) and switch on "Under Attack" mode during an attack. If you do, nginx must be told to read the visitor's real address from Cloudflare, or every visitor would look like one Cloudflare address.

To only watch and never block, set `AUTO_BLOCK=0` in `.env` and `pm2 reload bsrea-monitor`.

## Privacy

Nothing personal is stored, apart from the address of an attacker while it is blocked (the history keeps it masked, like `45.1.x.x`). Visitors are counted with a code made from the address and browser that changes every day, can't be turned back into an address, and is deleted after 2 days. API routes are stored as patterns (`/api/v1/verify/:id`, never the real number). From the membership database only counts are read: never a name, ID number or document. The dashboard's data is in `monitoring/data/monitor.db`. It isn't backed up because it holds only statistics.

## Security

- The password is stored as a scrypt hash. A sign-in lasts 12 hours, in an HttpOnly, SameSite=Strict, HTTPS-only cookie.
- After 5 wrong passwords, that address must wait 15 minutes.
- The app listens on 127.0.0.1 only; nginx is the only way in. If staff only work from the office, uncomment the `allow`/`deny` lines in `/etc/nginx/sites-available/bsrea-monitor`.
- Strict Content-Security-Policy: no outside scripts, styles or fonts. The page loads nothing from other websites.
- `npm run set-password` again changes the password and signs everyone out.

## Size

One Node.js process using about 70-100 MB of memory, with no packages to install (Node 24 runs the TypeScript directly, and SQLite is built in). Detail is kept per minute for 35 days, then as hourly and daily totals. That is a few MB a month.

## Trying it on a computer

```bash
cd monitoring
npm run demo-data   # 60 days of made-up numbers in data/demo.db (never the real file)
npm run demo        # http://127.0.0.1:3005, password: demo-password-123
```

For development: `npm install` (TypeScript, for checking types only), `npm test`, `npm run typecheck`.

## Files

| | |
| --- | --- |
| `src/server.ts` | the web server: sign-in, the dashboard page, `/api/dashboard` |
| `src/collector.ts` | what is collected and when (every minute, every 5 minutes, hourly, nightly) |
| `src/collect/nginx.ts` | reads the nginx log: visits, speed, errors, API routes |
| `src/collect/system.ts`, `apps.ts`, `checks.ts`, `business.ts` | server counters, PM2, the checks, membership counts |
| `src/alerts.ts` | when to alert, and sending to ntfy, Discord or Slack |
| `src/security.ts` | attack detection, the effect on visitors, automatic blocking; **the attack thresholds are here** (`RULES`) |
| `src/dashboard.ts` | turns the stored numbers into charts and advice; **the advice thresholds are here** |
| `public/` | the page: `app.js` (sections), `charts.js` (charts), `style.css` |
| `deploy/` | `install.sh`, the nginx files (log, protection, dashboard address) |
| `ecosystem.config.cjs` | the PM2 app `bsrea-monitor` |
