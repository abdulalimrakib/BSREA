# BSREA digital platform plan

> **Status (11 Nov 2026):** phases 0–3 are built: staff login and roles, online application with duplicate checks, review and approval, membership certificates with QR codes, and the verification pages. See `docs/security-and-duplicates.md`. Departures from this plan: SQLite (built into Node) instead of PostgreSQL for now; documents are stored encrypted on disk instead of in object storage. NOCs (phase 4) and content editing (phase 5) are not built yet.

Source: BSREA's "IT Officer" job circular (`IT Officer.jpg`, November 2026). Its list of duties describes the systems BSREA wants. This plan turns that list into features for this repo (`client/`, `admin/`, `backend/`).

## 1. What the circular asks for

| Duty in the circular | What gets built | Where |
| --- | --- | --- |
| Develop, maintain and upgrade BSREA website | Already rebuilt (see `docs/site-audit.md`). Next step: let staff edit news, people and pages without a developer. | client, admin, backend |
| Build and manage online membership system | Online application, review and approval, member accounts, annual renewals, member directory from the database | all three |
| Create digital membership certificates with QR code | A PDF certificate made on approval and renewal, with a QR code that opens a public verification page | backend, client |
| Develop NOC & certificate portal with online verification | Members request a NOC (No Objection Certificate) online. Staff review and issue it as a PDF with a QR code. Anyone can check it at `/verify`. | all three |
| Manage social media and digital communication | Share-ready news pages (preview images), email notices to members | client, backend |
| Database management, general IT support | One PostgreSQL database, backups, staff accounts with roles, an activity log | backend |

## 2. Who uses it

| Role | Can do |
| --- | --- |
| Visitor | Read the site, search the member directory, apply for membership, check a certificate at `/verify` |
| Member (company account) | Log in, see membership status and dues, download their membership certificate, request NOCs and download them, update company details (staff approve the changes) |
| Secretariat staff | Review applications and NOC requests, record payments, manage members, publish news |
| Approver (Secretary General / President) | Final approval of members and NOCs; their name and signature go on the certificates |
| Admin | Manage staff accounts and settings |

## 3. Main flows

### 3.1 Membership application (replaces the Word/PDF form)

1. The applicant fills in the online form: company details, applicant and contact person, membership type, and Local or Foreign.
2. They upload the 11 documents now listed on `/eligibility-membership-form` (trade licence, tax acknowledgement, BIN, memorandum and articles, incorporation certificate, NID or passport, visiting cards, photos, pay order or transfer receipt, and so on).
3. The fee is worked out from the published table:

   | | Admission fee | Annual subscription |
   | --- | --- | --- |
   | Local – General | BDT 25,000 | BDT 15,000 |
   | Local – Associate | BDT 20,000 | BDT 10,000 |
   | Foreign – General | USD 1,000 | USD 500 |

   All fees are exclusive of VAT and tax. They are stored as settings, not in code.
4. Status goes **Submitted → Under review → Needs changes (the applicant re-uploads) → Approved / Rejected**, and each change sends an email.
5. On approval, the system:
   - gives the member a number (e.g. `BSREA-M-2026-0231`),
   - creates the member account,
   - adds the company to the public directory,
   - issues the membership certificate.

### 3.2 Renewal

- The membership year and subscription status are kept for each member.
- Reminder emails go out 30 days and 7 days before expiry.
- Staff record each payment, which issues a new certificate for the year.
- Expired members are marked as such on `/verify`, and can be hidden from the directory.

### 3.3 NOC requests

1. A member in good standing (dues paid) fills in the NOC form: the purpose, who it is addressed to (e.g. NBR / Customs, a bank, a ministry), supporting documents, and goods or project details where needed.
2. Staff review it and edit the final text from a template. The approver approves it.
3. The system makes the PDF on BSREA letterhead. It has a reference number (e.g. `BSREA/NOC/2026/0045`), the issue date, the signature and a QR code.
4. The member downloads it. Staff can cancel a NOC later, and `/verify` will show it as cancelled.

### 3.4 Online verification

- Each certificate has a random, unguessable code. Its QR code points to `https://bsreabd.org/verify/<code>`.
- `/verify/<code>` shows:
  - the certificate type and number,
  - the company name,
  - the issue and expiry dates,
  - the status: **Valid / Expired / Cancelled**,
  - a fingerprint (hash) of the PDF, so a changed copy can be spotted.
- `/verify` also takes a typed certificate number. To limit guessing, it is rate-limited and must be paired with the company name.
- It shows no personal data (phone numbers, NID) on this page.

## 4. Technical design

| Part | Choice | Why |
| --- | --- | --- |
| Database | PostgreSQL (Neon or any managed Postgres) with Prisma | Relational data (members, applications, certificates), migrations, typed queries |
| API | The existing Express app in `backend/`, keeping the `{ success, message, statusCode, data }` response shape | Already set up with tests |
| Logins | Email and password with `httpOnly` session cookies, password reset by email. Members and staff are separate account types with roles. | Simple; no third-party dependency |
| File uploads | S3-compatible object storage in production, the local `backend/storage/` folder in development. Files are private and served through signed links. | Documents contain NIDs and passports |
| PDFs | `pdf-lib` or `@react-pdf/renderer`, using a letterhead template | Text stays searchable and selectable |
| QR codes | The `qrcode` npm package | Tiny, works offline |
| Email | SMTP or Resend, sent through a single `sendEmail()` helper | Also covers the contact form, which today only saves to a file |
| Admin panel | `admin/` (Next.js, already scaffolded) | Kept apart from the public site |
| Public site | Pages in `client/` that read members, posts and the board from the API instead of JSON | The JSON already goes through `lib/content.ts`, so only that file changes |
| Activity log | One `audit_log` table: who did what, and when | Needed for approvals and cancellations |

### Main tables

`members`, `member_contacts`, `applications`, `application_documents`, `payments`, `subscriptions`, `certificates` (type: membership or NOC, number, code, status, PDF hash), `noc_requests`, `noc_templates`, `users` (staff and members, with roles), `posts`, `board_members`, `settings` (fees, signatory, letterhead), `audit_log`.

### Moving the current data

- Load the 229 rows in `client/src/content/members.json` into `members`. Each company gets a member account it can claim by email.
- Load the 50 posts and the board into `posts` and `board_members`.

## 5. Phases

| # | Phase | Delivers | Rough size |
| --- | --- | --- | --- |
| 0 | Foundations | Database, Prisma schema and migrations, staff login with roles, email sending, file storage, admin panel shell, activity log | 1–2 weeks |
| 1 | Members in the database | Member records in admin (add, edit, list), import of the 229 members, public directory read from the API, contact-form messages shown in admin with an email to staff | 1 week |
| 2 | Online application | Public apply form with uploads, fee calculation, review queue in admin, status emails, approval that creates the member and account | 2 weeks |
| 3 | Certificates and verification | Membership certificate PDF with QR code, member dashboard download, `/verify` pages, cancellation, renewals and reminders | 1–2 weeks |
| 4 | NOC portal | NOC request form, templates, review and approval, NOC PDF with QR code, verification | 2 weeks |
| 5 | Content editing | News, board and gallery editing in admin, share previews, removal of the JSON content | 1–2 weeks |
| 6 | Launch | Hosting, domain, HTTPS, daily database backups, error monitoring, staff training, switch from WordPress | 1 week |

Each phase ships on its own and comes with backend tests (vitest + supertest) and client/admin tests.

## 6. Security and privacy

- **Uploaded documents** (NID, passport, trade licence) are private: they are never publicly linked and never shown on `/verify`.
- **Phone numbers and emails** are fully public in the directory today. Each member should choose what is shown.
- **Logins and the apply form** are rate-limited. The apply form has a spam trap or captcha, and accepted upload types and sizes are checked.
- **Approvals, cancellations and payment records** need the right role, and each one is logged.
- **Certificate codes** are random (at least 128 bits). PDFs carry a hash, so a changed copy can be detected.

## 7. Questions for BSREA before building

1. **NOCs:** What kinds of NOC does BSREA issue, and to whom (NBR/Customs, banks, ministries)? Is there a current template or a sample letter?
2. **Signatures:** Who signs membership certificates and NOCs? Is a scanned signature on the PDF acceptable?
3. **Payments:** Should members keep paying by pay order or bank transfer (staff record it), or should they pay online (SSLCommerz, bKash)?
4. **Membership year:** Does it run January–December, or 12 months from approval? Is there a grace period?
5. **NOC rules:** Must dues be paid before a member can request a NOC? Is there a fee for a NOC?
6. **Certificate design:** Is there a design or letterhead for the membership certificate?
7. **Directory privacy:** Which member details may be shown publicly?
8. **Hosting:** Where will it run (current host, a VPS, or Vercel plus managed Postgres)? Who owns the domain and DNS?
9. **Membership numbers:** Should existing members keep their current membership numbers? If so, is there a list?
