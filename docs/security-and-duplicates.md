# Security and duplicate checks

This is how the membership system protects applicants' personal data and stops one company from becoming a member twice. Each rule listed here has an automated test in `backend/tests/membership.test.ts`.

## Duplicate checks

Each application is checked against **all members** and **all open applications**:
- when it is submitted,
- again when staff open it,
- once more inside the approval transaction.

| Match | Result | Why |
| --- | --- | --- |
| Same company name, ignoring case, spaces, punctuation and "Ltd/Limited/Pvt/Co/M/S" | **Blocked** | The same company |
| Same trade licence, BIN or TIN, however it is typed ("TRAD/DNCC/123" = "trad dncc 123") | **Blocked** | The same legal entity |
| Same email or phone ("+880 1711-523423" = "01711523423") | **Flagged** for review | Real BSREA data has sister companies that share an owner's email and phone (6 emails and 2 phones are shared in the current directory) |
| Same applicant NID/passport as another application | **Flagged** | One person can run several companies |
| Company name ≥ 88% similar ("Engineerng" typo, word order) | **Flagged** | Catches typos without flagging firms that just share words |
| Same uploaded file (SHA-256) as another application | **Flagged** | Re-used or copied documents |

**How the rules are enforced:**
- **Blocked:** the public form refuses the application with a general message. It never says *which* member matched, so the form can't be used to find out who is a member or what their registration numbers are. Staff can see each blocked attempt in the audit log.
- **Flagged:** a staff member must confirm with a written note that the matches are separate companies. A **different** person must then approve (the four-eyes rule).
- **Database rules:** unique indexes enforce the same blocks, and the check and the insert run in one locked transaction. Two identical forms sent at the same moment can't both get in (this is tested).
- **Existing members:** the Duplicates page in the admin panel lists possible duplicates already in the member list. The import itself refused one: "Humayun Trading Corporation (Safari Solar)" is the same company as "Humayun Trading Corporation".

## Protecting personal data

| Data | Protection |
| --- | --- |
| NID/passport, trade licence, BIN, TIN numbers | Encrypted with AES-256-GCM (`ENCRYPTION_KEY`). Duplicate matching uses keyed fingerprints (HMAC-SHA256, `BLIND_INDEX_KEY`), so the numbers are never stored in readable form. Staff see them masked (`*****8877`). Only approvers and admins can reveal one, and every reveal is logged. |
| Applicants' and members' names, emails and phone numbers, and the contact person's details | Encrypted in the database. Duplicate checks and staff search use keyed fingerprints, never readable copies. |
| Contact-form messages | Each one is encrypted in `storage/contact-messages.jsonl`. |
| The full member list (with phone numbers and emails) | Kept only in `backend/data/members.private.json`, which git ignores and only your user can read, and in the encrypted database. The public website's directory shows company, name, designation, address and website only. A test fails if contact details reappear in the public data, and a lint rule stops browser-side code from importing the data module. |
| Files on disk | The database, documents, messages and `.env` can be read by the owner only (permissions 600/700). |
| Uploaded documents | Checked by their real content, so only PDF, JPG and PNG are accepted; a renamed `.exe` is refused. Limited to 5 MB each. Scanned for viruses by ClamAV when `CLAMAV_HOST` is set (if the scanner is down, uploads are refused rather than let through). At most 4 applications are processed at the same time, so a flood of large uploads can't exhaust the server's memory. Encrypted, stored under random names outside any public folder, and served only to logged-in staff as downloads. Every download is logged. |
| Public verification page | Shows only what is printed on the certificate. Codes are 144-bit random values, and lookups are rate-limited. |

## Staff accounts

- **Roles:**
  - **staff:** review applications.
  - **approver:** also approve or reject, issue or revoke certificates, and reveal ID numbers.
  - **admin:** also manage staff accounts and read the audit log.
- **Passwords:** at least 12 characters, mixing upper case, lower case and numbers. They are hashed with scrypt.
- **Two-factor login:** each login needs a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) as well as the password. Required for all staff in production (`REQUIRE_TWO_FACTOR`); staff without it can only reach the set-up screen. The secret is stored encrypted, each code works only once, and an admin can reset it for someone who lost their phone (that logs them out).
- **Lockout:** 5 wrong passwords or codes from one IP address lock the account *for that address* for 15 minutes. Someone guessing from elsewhere can't lock the real staff member out. On top of that, each IP address gets at most 10 login attempts per 15 minutes.
- **Login errors:** an unknown email and a wrong password get the same answer and take the same time, so the login form doesn't reveal which emails have accounts.
- **Sessions:** a random token in an `httpOnly`, `SameSite=Strict` cookie, which is also `Secure` in production. The database keeps only the token's hash. Sessions end after 8 idle hours or 24 hours in total. Changing a password logs out the account's other sessions.
- **Requests from other websites:** changes (POST and the like) from a website not on the allowed list are refused, which protects against cross-site request forgery (CSRF).

## Rest of the system

- **Security headers** on the API, the public site and the admin panel. The admin panel also sends a strict Content-Security-Policy and asks search engines not to index it.
- **No caching:** API answers are marked `no-store`, so browsers and proxies don't keep copies of personal data.
- **Rate limits:**
  - applications: 5 per hour per IP (forms sent back for typing mistakes don't count),
  - contact form: 10 per hour,
  - verification: 30 per 10 minutes,
  - the whole API: 300 per minute.
- **Audit log:** a log of logins, views, downloads, reveals and decisions. A database trigger refuses any edit or deletion of it.
- **Error messages** never reveal internal details.
- **Content-Security-Policy on the public site:** pages may load only from the site itself, the API, YouTube and Google Maps.
- **HSTS** on both websites in production.
- **Database version check:** the backend refuses to start on a database with an older layout instead of mixing plain and encrypted data.
- **Encryption keys are always required:** only the automated tests use a built-in key. A server started without the keys refuses to run.
- **Failed logins** record the typed email only if it looks like an email address, so a password typed into the email box is never logged.
- **Dependencies:** `npm audit` shows 0 known vulnerabilities in the production dependencies. multer and zod were upgraded to their patched releases.

## Backups and retention

- `npm run backup` makes a backup in `BACKUP_DIR` (default `backend/backups/`): the database encrypted with `ENCRYPTION_KEY`, plus the (already encrypted) documents and contact messages, and a manifest of SHA-256 checksums. It checks the new backup straight away and keeps the newest `BACKUP_KEEP` (default 14).
- `npm run backup -- --verify` checks that the newest backup can really be restored. `npm run restore -- <folder>` restores one (stop the server first; the old database is kept beside it).
- `npm run retention` deletes the documents of rejected applications `RETENTION_DAYS` (default 180) after the decision, and cleans up expired sessions. Add `--dry` to only count.
- Run both daily, for example with cron:
  ```
  15 2 * * *  cd /path/to/backend && npm run backup && npm run retention
  ```
  Then copy `BACKUP_DIR` to another machine or cloud storage. A backup on the same disk doesn't survive a disk failure.

## Setting up

```bash
cd backend
npm run keygen          # prints ENCRYPTION_KEY and BLIND_INDEX_KEY. Put them in .env and back them up
npm run seed -- --admin-email you@example.com --admin-name "Your Name"   # asks for the password
npm run reset-password  # forgotten password: lists accounts; then -- --email <email> to set a new one
npm run dev
cd ../admin && npm run dev    # http://localhost:3001, staff panel
cd ../client && npm run dev   # http://localhost:3004, public site (/membership/apply, /verify)
```

**If `ENCRYPTION_KEY` is lost, stored ID numbers and documents can't be read again.** Keep it in a password manager and in the server's secret settings, never in git. In production the backend refuses to start without both keys.

## Still to do before real data goes in

1. **HTTPS and hosting:** HTTPS everywhere (cookies are `Secure` only when `NODE_ENV=production`). Set `TRUST_PROXY=1` behind a reverse proxy so rate limits and lockouts see real visitor IPs.
2. **Schedule the backups and retention** (see above) and copy backups off the server. Test a restore once.
3. **Install ClamAV** on the server (`clamd`) and set `CLAMAV_HOST=127.0.0.1`.
4. **Email:** email notices (application received, decision) and a password-reset flow. Needs an email provider.
5. **Scaling:** move from SQLite to PostgreSQL if several servers will run the API.

Done: two-factor login, lockout per IP, upload memory limit, virus-scanning support, backups, data retention, removing phone numbers and emails from the public directory, and removing the secretariat staff's personal mobile numbers from the Management page (only BSREA's official numbers are published; a test checks this).

**Known limits:** the public application form answers "already exists" for a company that is a member, which is inherent to blocking duplicates; it is rate-limited and never says which member matched.
