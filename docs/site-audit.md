# bsreabd.org: audit and replication notes

Audited on 11 November 2026. The live site was rebuilt in `client/` (Next.js), with the contact form handled by `backend/`.

## What the live site is

| | |
| --- | --- |
| Platform | WordPress 7.1 on LiteSpeed (PHP 8.1), host `stack7-bd.ethii.com` |
| Theme / builder | Blocksy theme with Elementor Pro (pages are built in Elementor) |
| Plugins seen | Elementor / Elementor Pro, LiteSpeed Cache, Image Optimizer, FluentSnippets, DataTables (member directory), WPDA Org Chart |
| Brand colours | Yellow `#FBC117`, green `#097834`, slate `#3A4F66`, navy `#192A3D`, grey `#787878`, light `#F2F5F7` / `#FAFBFC` |
| Fonts | Montserrat (body and section headings), Playfair Display (page titles and post titles), Roboto (small UI text) |

### Content inventory

| Type | Count | Where it lives now |
| --- | --- | --- |
| Pages | 18 (16 real, plus "Future Plan" and an empty "News and Events" page) | One route per page in `client/src/app/` |
| News posts | 50 (May 2025 to Aug 2026) | `client/src/content/posts.json`, served at `/<slug>` like WordPress |
| Member directory | 229 companies | `client/src/content/members.json` |
| Executive committee 2025-26 | 21 people in 3 rows | `client/src/content/board.json` |
| Member logos (home page) | 42 general + 44 associate | `client/src/content/member-logos.json` |
| Gallery | 82 photos + 5 YouTube videos | `client/src/content/gallery.json` |
| Media | 546 files in the WordPress library; the 263 that pages actually use were downloaded | `client/public/uploads/` (same folder layout as `wp-content/uploads`) |
| Custom post types | `member`, `executive-committee`, `expert-network`, `academic-collaborato`, `youth-emerging-lea` | Only `member` and `executive-committee` are shown anywhere; the other three hold placeholder entries (lorem ipsum) and are not linked from the site |

### Menu

Home · About (Mission & Vision, Our Projects, Member Welfare, CSR) · Membership (Member Directory, Eligibility & Membership Form) · Governance (Board of Director, Management) · Media Center (News and Events, Gallery, Publications, Information) · Contact.

Pages outside the menu: BSREA Newsletter (`/bsrea-newsletter`) and Job Circular (`/job-circular-event-program-officer`). Both were rebuilt.

## Problems found on the live site

These were fixed in the rebuild unless the note says otherwise.

1. **Broken "View More" links.** On Mission & Vision, the four project buttons go to `/amar-gram-amar-shohor/`, `/responsible-use-of-electricity/`, `/achieving-sdgs/` and `/green-finance/`, which return 404. The rebuild links them to sections on `/projects`, and redirects the old addresses there.
2. **Associate member logos are almost all missing.** 43 of the 44 images in the home page "Associate member" tab return 404 (Canadian Solar, Siemens, Huawei, SMA and others). Only the one that loads is kept. *The logo files need to be uploaded again.*
3. **Member directory "Details" links.** 19 company websites were saved without `https://` (for example `www.idfbd.org`), so they opened as broken links on bsreabd.org. Fixed in the data.
4. **National Database links.** Several links point to `bsreabd.org/national-database-of-renewable-energy/index.php?...` (404). Most "RE Large Projects on Map" and "Sub-district wise" entries all point to the same `i=1` page. The rebuild builds every link from SREDA's own pattern (`ndre.sreda.gov.bd/index.php?id=…&i=…`). "Techlology" in the capacity table was corrected to "Technology".
5. **Newsletter "Read More".** The "Bangladesh's Sovereign Risk Trap" story linked to the PSREF post. It now links to the roundtable post.
6. **Member Welfare page renders without its layout.** It has no page banner, and its Elementor styles don't load, so the icons show at full size. It was rebuilt in the same style as the other pages.
7. **Leftover WordPress sample content.** "Future Plan" (`/future-plan/`) is the default "This is an example page…" text. It is not in the menu and was not carried over (it returns 404).
8. **Inconsistent numbers.** The About page says "170+ active members and 21 executive members". The home page says "over 200 active members". The directory lists 229. *The copy was kept as written; someone at BSREA should decide which number is right.*
9. **Copyright year** is fixed at "© 2025". The rebuild shows the current year.
10. **Home "Latest News" pagination** ("Next »" to `/page/2/`) jumped to a bare blog archive. The rebuild links to `/news-and-events`, and `/page/N` redirects to `/news-and-events/page/N`.
11. **Unusual post addresses.** Some post addresses are odd (`/3960-2/`, an emoji, and Unicode "bold" letters). They were kept unchanged so existing links keep working.

## How the rebuild is organised

- `client/src/lib/site.ts`: name, address, phone numbers, email, social links and the main menu.
- `client/src/lib/content.ts`: the only place pages read content from. If the content later moves to the backend, only this file changes.
- `client/src/components/site/`: header (dropdown menu and mobile menu), footer, page banner, buttons, post cards, YouTube player.
- Interactive pieces: hero slideshow, member logo tabs, searchable member table (it replaces DataTables), photo lightbox, video playlist, contact form.
- `backend/routes/contact.routes.ts`: `POST /api/v1/contact` checks the form and adds each message to `backend/storage/contact-messages.jsonl`. The live site used an Elementor form; nothing sends email yet.
- Old WordPress addresses keep working. A trailing slash redirects to the same page, posts stay at `/<slug>`, and `/wp-content/uploads/*` redirects to `/uploads/*` (see `client/next.config.ts`).

## Not carried over / still to do

- **Contact form email.** Messages are saved on the server but nobody is notified. Add an email service (or show the messages in `admin/`) before launch.
- **Content editing.** Content is in JSON files, so the admin panel or a CMS is needed before non-developers can post news.
- **New posts on bsreabd.org** published after 11 Nov 2026 are not in this copy.
- **Large images.** Images larger than 400 KB were resized to at most 1920px wide and recompressed, which saved about 15 MB. `public/uploads` is still about 62 MB, mainly because of the 6 MB annual report PDF and a few large PNG posters.
- The hidden custom post types (expert network, academic collaborators, youth leaders) only contain placeholder text and were left out.
