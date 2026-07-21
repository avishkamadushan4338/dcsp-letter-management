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

- **Backend:** TypeScript + [Effect](https://effect.website) (`@effect/platform`,
  `@effect/platform-node`, `@effect/sql-mysql2`) on Node.js, MySQL (`mysql2`),
  Nodemailer.
- **Frontend:** React + TypeScript, built with Vite (single-page app, client-side
  routing via `react-router-dom`). Sinhala + English via `web/public/locales/*.json`,
  fetched at runtime and toggled with the same `localStorage` key as before.
- **Auth:** simple cookie-session login for DCS/Subject-Officer staff; the Relevant
  Officer authenticates implicitly via a signed, expiring link token
  (`LINK_SECRET`) - unchanged from the original design, just re-typed.

This is a TypeScript/Effect + React/Vite port of the system's original Express +
vanilla-JS implementation - same workflow, same roles, same fields, same validation
rules, same emails, same visual design and responsive behavior. No functionality was
added or removed in the port.

## Getting started

```bash
npm install
cp .env .env.local   # then edit values (already scaffolded with placeholders)
mysql -u root -p < data/schema.sql
npm run dev
```

`npm run dev` starts both the backend (`server/`, Effect HTTP server on `PORT`,
default `3000`) and the frontend (`web/`, Vite dev server on `5173`, proxying `/api`
to the backend) together. Visit `http://localhost:5173` in development.

For a production-style run, build both packages and let the backend serve the built
frontend from a single port:

```bash
npm run build
npm start
```

Visit `http://localhost:3000`.

## Project layout

- `server/` - TypeScript + Effect backend.
  - `src/http/routes/` -> `src/repositories/` / `src/services/` - same
    routes -> controllers -> services/models shape as the original Express app, just
    typed and composed with Effect `Layer`s instead of `require()`.
  - `src/http/router.ts` - combines every route group, maps tagged domain errors to
    HTTP status codes, and serves `web/dist` (with an SPA fallback to `index.html`)
    the way `express.static` used to.
- `web/` - React + Vite frontend.
  - `src/pages/` - one component per original page (`Login`, `Dashboard`,
    `NewLetter`, `SubjectOfficerDashboard`, `SubjectOfficerNewLetter`,
    `SubjectOfficerLink`, `RelevantOfficerLink`, `PrintNumbers`).
  - `src/styles/` - the original `main.css` / `print.css` / `sinhala.css`, ported
    essentially verbatim (fluid `clamp()`-based type/spacing scale, container
    queries, mobile table->card collapse, `prefers-reduced-motion` support).
  - `src/i18n/` - the si/en toggle as a React context, same `/locales/{lang}.json`
    runtime fetch and `dcs_lang` localStorage key as before.
- `data/schema.sql` - MySQL schema: `officers`, `number_sequence`, `letters`,
  `links`, `letter_reassignments`. Unchanged by the port.

## Number issuing

Each division (`01`, `02`, `03` - see `web/src/lib/config.ts`) has its own sequence in
`number_sequence`. Numbers are issued atomically (`SELECT ... FOR UPDATE` inside an
Effect `sql.withTransaction`) as `DCSP/{division}/{NNNNN}` (e.g. `DCSP/01/00123`) and
wrap back to `0` after `99999`. `print-numbers` can list today's created letters for
printing onto a label sheet.

## Officer links

Links emailed to officers are signed (`HMAC-SHA256` over `letterId + role + expiry`)
via `server/src/services/TokenService.ts`, and a row is recorded in `links` so a token
can only be used once and expires after `LINK_EXPIRY_HOURS`.
