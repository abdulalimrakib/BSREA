# BSREA

| Folder     | What it is                                         | Port |
| ---------- | -------------------------------------------------- | ---- |
| `client/`  | Public website (a rebuild of bsreabd.org): Next.js 15, React 19, Tailwind 4 | 3004 |
| `admin/`   | Staff panel: membership applications, duplicate review, members, certificates, audit log | 3001 |
| `backend/` | REST API: Express 4, TypeScript, SQLite (built into Node 24) | 3002 |

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

## The website

`client/` is a copy of https://bsreabd.org (WordPress) rebuilt in Next.js. Every page, the 50 news posts, the member directory, the board and the gallery were carried over. `docs/site-audit.md` lists what the live site contains, the problems found there, and what is still to do.

- Content: `client/src/content/*.json`, read only through `client/src/lib/content.ts`
- Contact details, social links and the menu: `client/src/lib/site.ts`
- Images and PDFs: `client/public/uploads/` (same folders as WordPress `wp-content/uploads`)
- The contact form posts to `POST /api/v1/contact`. Messages are saved to `backend/storage/contact-messages.jsonl`.

## Membership system

Visitors apply online at `/membership/apply`. Staff review in `admin/`: duplicate checks, approval, then a member number and a QR-coded certificate. Anyone can check a certificate at `/verify`. **Read `docs/security-and-duplicates.md` before putting real data in**: it explains the encryption keys, the duplicate rules and what is still to do.

## Conventions

- API routes go under `/api/v1/...` and answer `{ success, message, statusCode, data }` (`backend/utils/response.ts`).
- Backend layers: `routes/` only list URLs and middleware → `controllers/` read the request and send the response → `services/` do the work and talk to the database (`db/`).
- Wrap async route handlers in `asyncHandler` so errors reach `middleware/error.handler.ts`.
- The client calls the backend only through `request()` in `client/src/lib/api.ts`.

## Scripts

| | backend | client |
| --- | --- | --- |
| dev | `npm run dev` (nodemon) | `npm run dev` |
| test | `npm test` (vitest + supertest) | `npm test` (vitest + jsdom) |
| checks | `npm run typecheck` | `npm run lint`, `npm run build` |
