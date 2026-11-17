# BSREA

| Folder     | What it is                                         | Port |
| ---------- | -------------------------------------------------- | ---- |
| `client/`  | Public website (a rebuild of bsreabd.org): Next.js 15, React 19, Tailwind 4 | 3004 |
| `admin/`   | Staff panel: membership applications, duplicate review, members, certificates, audit log | 3001 |
| `backend/` | REST API: Express 4, TypeScript, SQLite (built into Node 24) | 3002 |
| `monitoring/` | Monitoring dashboard: uptime, traffic, speed, server, attack protection, alerts to your phone. A separate app that watches the others from outside | 3005 |

**Live** (an Oracle Cloud server, 1 GB; `bsreabd.org` later):

| | |
| --- | --- |
| Public website | https://bsrea-demo.duckdns.org |
| Staff panel | https://admin.bsrea-demo.duckdns.org |
| Monitoring | https://monitor.bsrea-demo.duckdns.org |

## Getting started

```bash
cd backend && cp .env.example .env && npm install
npm run keygen   # paste the two keys into backend/.env and back them up
npm run seed -- --admin-email you@example.com --admin-name "Your Name"   # imports members, creates the first admin
npm run dev
npm run backup   # daily: encrypted backup (see docs/security-and-duplicates.md); npm run retention cleans up old documents
cd client && cp .env.example .env.local && npm install && npm run dev
cd admin  && cp .env.example .env.local && npm install && npm run dev
```

Check the API: `curl http://localhost:3002/health` should return `{"status":"ok"}`.

Each folder has its own README with more detail (`admin/README.md`, `monitoring/README.md`).

## The website

`client/` is a copy of https://bsreabd.org (WordPress) rebuilt in Next.js. Every page, the 50 news posts, the member directory, the board and the gallery were carried over. `docs/site-audit.md` lists what the live site contains, the problems found there, and what is still to do.

- Content: `client/src/content/*.json`, read only through `client/src/lib/content.ts`
- Contact details, social links and the menu: `client/src/lib/site.ts`
- Images and PDFs: `client/public/uploads/` (same folders as WordPress `wp-content/uploads`)
- The contact form posts to `POST /api/v1/contact`. Messages are saved to `backend/storage/contact-messages.jsonl`.

## Membership system

Visitors apply online at `/membership/apply`. Staff review in `admin/`: duplicate checks, approval, then a member number and a QR-coded certificate. Anyone can check a certificate at `/verify`. **Read `docs/security-and-duplicates.md` before putting real data in**: it explains the encryption keys, the duplicate rules and what is still to do.

## Deploying

`deploy/push.sh ubuntu@SERVER_IP` builds the API and both websites on this computer (the server has too little memory to build them), copies the code to `/srv/bsrea` and restarts the three apps with PM2. It never copies `.env` files, databases, uploaded documents or backups. To deploy the demo copy:

```bash
SITE_URL=https://bsrea-demo.duckdns.org DEMO_MODE=1 deploy/push.sh ubuntu@SERVER_IP
```

The monitoring dashboard is copied along with everything else but restarted separately: `ssh ubuntu@SERVER_IP "pm2 reload bsrea-monitor"`. First-time server set-up, HTTPS, backups and troubleshooting are in `docs/deployment.md`.

## Monitoring

`monitoring/` watches the sites, the API and the server without changing them. It works from the nginx log, the server's counters, PM2, and the membership database opened read-only. It has seven pages: Overview, Traffic, Performance, Server, Security, Uptime & alerts, and Membership. It also gives advice on when to grow the server. It protects against attacks (rate limits, and temporary blocking of addresses that probe for weak spots, guess staff passwords or flood the site). **It only warns, on the dashboard and on your phone, when real visitors are affected**: an attack that is stopped is recorded, not reported. Set-up and details: `monitoring/README.md`.

## Documents

| | |
| --- | --- |
| `docs/security-and-duplicates.md` | encryption, duplicate rules, staff accounts, backups. **Read before putting real data in** |
| `docs/deployment.md` | setting up the server, HTTPS, backups, updates, what to do when something breaks |
| `docs/site-audit.md` | what the old WordPress site contained and what is still to do |
| `docs/digital-platform-plan.md` | the plan, from BSREA's IT Officer job circular: what is built (phases 0–3) and what isn't yet (NOCs, content editing) |
| `docs/membership-workflow.drawio` | the application → review → approval → certificate flow (open with draw.io) |

## Conventions

- API routes go under `/api/v1/...` and answer `{ success, message, statusCode, data }` (`backend/utils/response.ts`).
- Backend layers: `routes/` only list URLs and middleware → `controllers/` read the request and send the response → `services/` do the work and talk to the database (`db/`).
- Wrap async route handlers in `asyncHandler` so errors reach `middleware/error.handler.ts`.
- The client calls the backend only through `request()` in `client/src/lib/api.ts`.

## Scripts

| | backend | client | admin | monitoring |
| --- | --- | --- | --- | --- |
| dev | `npm run dev` (nodemon) | `npm run dev` | `npm run dev` | `npm run demo` (made-up data; `npm run demo-data` first) |
| test | `npm test` (vitest + supertest) | `npm test` (vitest + jsdom) | `npm test` (vitest + jsdom) | `npm test` (node:test) |
| checks | `npm run typecheck` | `npm run lint`, `npm run build` | `npm run lint`, `npm run build` | `npm run typecheck` |

Backend only: `npm run backup`, `npm run restore`, `npm run retention`, `npm run reset-password`, `npm run seed`. Monitoring only: `npm run set-password`, `npm run test-alert`.
