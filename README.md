# Letter Management System

Bilingual (Sinhala / English) letter tracking system for a Divisional Correspondence
Secretariat (DCS). Tracks incoming letters from receipt to closure:

1. A letter enters the system either via **DCS**, who logs it, issues a unique
   division-scoped number, and assigns a *subject officer* and a *relevant officer*;
   or via the **subject officer** themselves, who can send it straight to a relevant
   officer or submit it to DCS to review and assign a relevant officer first.
2. The system emails each officer a unique, tokenised link (no login required).
3. The **subject officer** opens their link, marks the letter received, and sends it
   onward to the relevant officer.
4. The **relevant officer** opens their link, marks it received, and records the action
   taken.
5. DCS sees live status for every letter on the dashboard.

## Stack

- **Backend:** Node.js, Express, MySQL (`mysql2`), Nodemailer
- **Frontend:** static HTML/CSS/vanilla JS (no build step), Sinhala + English via
  `public/locales/*.json`
- **Auth:** simple cookie-session login for DCS staff; subject/relevant officers
  authenticate implicitly via a signed, expiring link token (`LINK_SECRET`)

## Getting started

```bash
npm install
cp .env .env.local   # then edit values (already scaffolded with placeholders)
mysql -u root -p < data/schema.sql
npm run dev
```

Visit `http://localhost:3000`.

## Project layout

- `public/` — frontend pages (`dashboard.html`, `new-letter.html`,
  `subject-officer.html`, `relevant-officer.html`, `print-numbers.html`) and shared
  `css/`, `js/`, `locales/`, `fonts/`.
- `server/` — Express app: `routes/` → `controllers/` → `services/` / `models/`.
- `data/schema.sql` — MySQL schema: `officers`, `number_sequence`, `letters`, `links`.

## Number issuing

Each division (`01`, `02`, `03` — see `public/js/config.js`) has its own sequence in
`number_sequence`. Numbers are issued atomically (`SELECT ... FOR UPDATE`) as
`DIVISION/SEQ/YEAR` (e.g. `01/00123/2026`) and wrap back to `1` after `99999`.
`print-numbers.html` can pre-issue a batch of 16 numbers for printing onto a label
sheet before letters are matched to them.

## Officer links

Links emailed to officers are signed (`HMAC-SHA256` over `letterId + role + expiry`)
via `server/services/tokenService.js`, and a row is recorded in `links` so a token can
only be used once and expires after `LINK_EXPIRY_HOURS`.
