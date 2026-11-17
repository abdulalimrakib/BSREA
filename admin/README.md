# BSREA staff panel (`admin/`)

Where BSREA staff review membership applications, check duplicates, approve members and issue certificates. Next.js 15, React 19, Tailwind 4 and shadcn/ui, port **3001**. It has no database of its own: everything goes through the backend API (`backend/`, port 3002).

Live: https://admin.bsrea-demo.duckdns.org (staff accounts only; search engines are told not to index it).

## Pages

| Page | What staff do there | Who |
| --- | --- | --- |
| `/` | Four tiles: open applications, applications that need a duplicate check, active members, valid certificates | everyone |
| `/applications`, `/applications/[id]` | Open an application, see its documents and duplicate matches, mark duplicates as checked, approve or reject | staff review; **approvers** decide |
| `/duplicates` | Possible duplicates already in the member list | everyone |
| `/members` | The member list; issue a membership certificate | approvers issue |
| `/certificates` | Issued certificates: download the PDF, revoke one | approvers revoke |
| `/staff` | Staff accounts: add, deactivate, reset two-factor | **admins** |
| `/audit-log` | Every login, view, download, reveal and decision (can't be edited or deleted) | **admins** |

**Roles:**
- **staff:** review applications.
- **approver:** also approve or reject, issue or revoke certificates, and reveal full ID numbers.
- **admin:** also manage staff accounts and read the audit log.

**Sign-in:** a password plus a 6-digit code from an authenticator app (two-factor login is required in production). Staff without two-factor set up can only reach the set-up screen. The rules for duplicates, encryption and lockouts are in `docs/security-and-duplicates.md`.

## Running it

```bash
cd admin
cp .env.example .env.local   # NEXT_PUBLIC_API_URL (the backend), NEXT_PUBLIC_SITE_URL (the public site, for certificate links)
npm install
npm run dev                  # http://localhost:3001 (the backend must be running too)
```

The first admin account is made by the backend: `cd backend && npm run seed -- --admin-email you@example.com --admin-name "Your Name"`. A forgotten password is reset with `npm run reset-password` in `backend/`.

| | |
| --- | --- |
| `npm run dev` | development server on port 3001 |
| `npm test` | tests (vitest + jsdom) |
| `npm run lint` | ESLint |
| `npm run build` | production build |

## Code

| | |
| --- | --- |
| `src/app/` | one folder per page (App Router) |
| `src/lib/api.ts` | **every** call to the backend goes through here (types for applications, members, staff…) |
| `src/components/auth-gate.tsx` | shows the sign-in form (password, then the code) until someone is signed in, and the two-factor set-up to staff who still need it |
| `src/components/` | navbar, two-factor set-up, shared pieces; `ui/` holds the shadcn/ui components |
| `next.config.ts` | strict security headers on every page (Content-Security-Policy, no framing, no indexing, HSTS in production) |

## Production

The panel is built on a computer, not on the server (the 1 GB server doesn't have the memory to build it). `deploy/push.sh` builds it into `.next-prod` with an empty `NEXT_PUBLIC_API_URL`, so the browser calls `/api` on the panel's own address and nginx passes it to the backend; the sign-in cookie never leaves `admin.…`. PM2 runs it as `bsrea-admin` (see `deploy/ecosystem.config.cjs` and `docs/deployment.md`).
