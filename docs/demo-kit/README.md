# BSREA membership demo kit

A 15-minute live demo of the whole membership process: applying, fraud being stopped, staff review,
the certificate, checking it with a phone, and cancelling it. Everything here is made up and marked
**SAMPLE – DEMO ONLY**. `backend/tests/demo-kit.test.ts` runs this exact script on every test run, so if
the system changes and a step would no longer work, the tests fail.

| In this folder | |
| --- | --- |
| `files/1-sunrise/` | documents for the honest company (with payment receipt) |
| `files/3-sunnrise/` | documents for the look-alike company (no payment receipt, on purpose) |
| `files/fake.pdf` | a "program" pretending to be a PDF |
| `values.json` | the form values below, as data (used by the test) |

## Prepare (the day before)

1. **Deploy** to the demo server. On the server, `backend/.env` needs `PAYMENT_RECEIPT_REQUIRED=0`. Then, from this computer:
   `SITE_URL=https://bsrea-demo.duckdns.org DEMO_MODE=1 PAYMENT_REQUIRED=0 deploy/push.sh ubuntu@SERVER_IP`
2. **Demo data only.** If the admin panel's Members page shows real company names, on the server run
   `cd /srv/bsrea/backend && npm run backup && npm run demo-data -- --confirm` (deletes everything there and adds 40 "Demo …" members).
3. **Two staff accounts**, both with the authenticator app on your phone:
   **you** (role *admin*) and **Reviewer** (role *staff*; create it on the admin panel's Staff page, then log in once to set up two-factor login).
4. **Copy the `files/` folder** to the laptop you present from.
5. **Rehearse once, then reset**: on the server `cd /srv/bsrea/backend && npm run demo-reset -- --confirm && pm2 restart bsrea-api`.
   The reset only runs when every company is a "Demo …" company, so it can't delete real data.

> **Limit:** 5 applications per hour from one internet connection, and refused duplicates count. The script uses 3.
> If you make mistakes, reset (it restarts the limit) or send from your phone on mobile data.

## The script

Public site: **bsrea-demo.duckdns.org** · Staff panel: **admin.bsrea-demo.duckdns.org**

**1. Staff dashboard (30 sec).** Log in as you. Show the tiles; nothing is open yet.

**2. An honest company applies.** Public site → Membership → Apply. Upload every file in `1-sunrise/`.

| Company is: Local · Membership type: General | |
| --- | --- |
| Company name | `Demo Sunrise Solar Ltd` |
| Trade licence number | `TRAD/DNCC/DEMO-5001/2026` |
| BIN | `000-DEMO-5001` |
| Company email / phone | `info@sunrise.example.com` / `01000009001` |
| Company address | `House 9, Road 3, Gulshan, Dhaka` |
| Applicant: full name / designation | `Demo Applicant One` / `Managing Director` |
| Applicant: email / mobile | `md@sunrise.example.com` / `01000009002` |
| NID or passport number | `DEMO-NID-90001` |

✅ *Application received* with a reference number. **Say:** documents are checked by content and stored encrypted.

**3. Fraud at the door.**

a. **Copycat**: apply again with the name written differently. Files from `1-sunrise/`.
`M/S. Demo Sunrise Solar Limited` · licence `TRAD/DNCC/DEMO-5002/2026` · BIN `000-DEMO-5002` ·
`info@copycat.example.com` / `01000009011` · `House 1, Road 1, Banani, Dhaka` ·
`Demo Applicant Two`, `Director`, `director@copycat.example.com` / `01000009012` · NID `DEMO-NID-90002`
🛑 *Refused.* **Say:** "M/S", "Limited", spaces and capitals are ignored. The public isn't told *which* member matched.

b. **Look-alike with a fake file**: files from `3-sunnrise/`, but pick `fake.pdf` as the *Trade Licence*.
`Demo Sunnrise Solar Ltd` (double n) · licence `TRAD/DNCC/DEMO-5003/2026` · BIN `000-DEMO-5003` ·
`info@sunnrise.example.com` / **`01000009001`** (same phone as Sunrise) · `House 12, Road 7, Uttara, Dhaka` ·
`Demo Applicant Three`, `CEO`, `ceo@sunnrise.example.com` / `01000009022` · NID `DEMO-NID-90003`
🛑 *Only PDF, JPG or PNG files are accepted.* **Say:** the file was named .pdf but was really a program.
Now pick the real `trade-licence.pdf` from `3-sunnrise/` and send again: ✅ accepted, but flagged.

**4. Staff review.** Admin panel → Applications → *Demo Sunnrise Solar Ltd*. Show, without clicking anything yet:
the flags (similar company name, same phone as Sunrise) · ID numbers masked (*Reveal* is logged) ·
the red **No payment receipt** warning · *Approve* is greyed out: *someone must confirm the flagged matches first*.

**5. The honest company: two people.** *Demo Sunrise Solar Ltd* is flagged too (the look-alike points back at it).
- Log in as **Reviewer**, open it, type the note `Original company; the look-alike is checked separately`,
  click *Confirm these are not duplicates*. **Say:** Reviewer has no *Approve* button; staff can't approve.
- Log in as **you**, open it, *Approve* → ✅ *member added and certificate issued*.

**6. The look-alike: one person can't do both.** Open *Demo Sunnrise Solar Ltd* as **you**.
- Note `Checking the two-person rule` → *Confirm these are not duplicates* → *Approve* → 🛑 *another person must approve
  an application whose duplicates you cleared*.
- Change the note to `Look-alike of Demo Sunrise Solar Ltd; a fake file was uploaded` → *Reject* ✅.

**7. The certificate.** Certificates → *PDF*. Show the member number, the official address under the QR code and
the warning at the bottom. **Scan the QR code with your phone** (or let the audience scan it from the screen) → ✅ *Valid*.
Point to the address bar and the "Make sure the paper certificate is genuine" box.

**8. A forged certificate.** On the phone open `bsrea-demo.duckdns.org/verify` and type any 24 letters → 🛑 *Not a BSREA certificate*.

**9. Cancelling.** Admin → Certificates → *Revoke* (reason `Demo: membership cancelled`). Scan the same QR code again → 🛑 *Revoked*.
Back on the dashboard the **Cancelled/expired certificates checked** tile turns amber; the Certificates page shows *1 after it ended*.

**10. Accountability.** Audit log page: every step above, with who, what, when and from where.

## After the demo

`npm run demo-reset -- --confirm && pm2 restart bsrea-api` on the server. Staff accounts and the audit log are kept
(the audit log can never be deleted, by design).

## Rehearsing on your own computer

Run `npm run dev` in `backend`, `client` and `admin`, with `PAYMENT_RECEIPT_REQUIRED=0` in `backend/.env`.
Your local database holds the **real** member list, so first point the backend at a separate demo database:
`DATABASE_FILE=storage/demo.db npm run seed -- --admin-email you@example.com --admin-name "You"`, then
`DATABASE_FILE=storage/demo.db npm run demo-data -- --confirm`, and start the backend with the same `DATABASE_FILE`.
A phone can't open `localhost`, so open certificates with the *Verify page* link on the Certificates page instead of scanning.
