# BSREA

| Folder     | What it is                                         | Port |
| ---------- | -------------------------------------------------- | ---- |
| `client/`  | Public website: Next.js 15, React 19, Tailwind 4, shadcn/ui | 3004 |
| `admin/`   | Admin panel (empty, not set up yet)                | 3001 |
| `backend/` | REST API: Express 4, TypeScript                    | 3002 |

## Getting started

```bash
cd backend && cp .env.example .env && npm install && npm run dev
cd client  && cp .env.example .env.local && npm install && npm run dev
```

Check the API: `curl http://localhost:3002/health` should return `{"status":"ok"}`.

## Conventions

- API routes go under `/api/v1/...` and answer `{ success, message, statusCode, data }` (`backend/utils/response.ts`).
- Wrap async route handlers in `asyncHandler` so errors reach `middleware/error.handler.ts`.
- The client calls the backend only through `request()` in `client/src/lib/api.ts`.

## Scripts

| | backend | client |
| --- | --- | --- |
| dev | `npm run dev` (nodemon) | `npm run dev` |
| test | `npm test` (vitest + supertest) | `npm test` (vitest + jsdom) |
| checks | `npm run typecheck` | `npm run lint`, `npm run build` |
