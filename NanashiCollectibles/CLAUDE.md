# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

- **Name (per `package.json`):** `nanashicollectibles-office`. **Name (per `index.html` `<title>`):** "Hobby Fest Brunei Darussalam". These don't match — **Needs clarification**: which is the live product name/branding?
- **What it is:** The customer-facing frontend of NanashiCollectibles, one app inside the `GamerTavern` monorepo (git root is one directory above this folder — sibling projects are `Backend/`, `Database/`, and unrelated `Portfolio_Jae/Recce/Zulfitri` sites).
- **Business direction:** per business requirements provided by the owner, NanashiCollectibles is intended to grow into a multi-purpose platform — TCG ecommerce/community (Digimon, Pokémon, MTG, Vanguard, Ultraman), collectibles, Gunpla, drone/computer parts, drone/website/app professional services, esports tournament registration (starting with an RVS Apex Legends tournament), and internal office/admin tooling. This is the intended direction, not necessarily what's implemented yet.
- **Target users:** collectors/customers (public site), merchants (admin/product management — partially built, see §19 and §20), and eventually internal office staff.
- **Architecture:** React SPA frontend (this folder) talking to a separate Express + Socket.IO backend (`../Backend/`) backed by MySQL (`../Database/`).
- **Current development status: mid-reset.** `src/` currently contains only the default Vite starter (`App.jsx`, `main.jsx`, `index.css`) — no router, no pages, no components, no API/socket client. This is an **uncommitted** working-tree state (`git status` shows the prior app's files as pending deletions), not a committed release. The prior app (shop, chat, trading, news, login, profile pages — see deleted paths in `git status`) is gone from disk but still recoverable via `git checkout` on those paths if needed. Do not assume any pre-reset component still exists without checking `src/` first.

## 2. Repository Structure

```text
NanashiCollectibles/            (this app — git root is one level up, at GamerTavern/)
├── src/
│   ├── App.jsx                 default Vite starter component (counter demo)
│   ├── main.jsx                ReactDOM root — renders <App/> directly, no router
│   └── index.css               Tailwind directives + a leftover "fantasy/hologram" theme (unused by current App.jsx)
├── public/
│   ├── assets/game-bg/         7 background images (auth/cart/chat/news/profile/shop/trade) — leftovers from the deleted pages
│   └── vite.svg, assets/react.svg
├── index.html                  entry HTML (title: "Hobby Fest Brunei Darussalam")
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── render.yaml                 Render.com deploy config (see §11)
├── .env                        non-secret URLs only (see §10)
└── CLAUDE.md                   this file

../Backend/                     separate Express 5 + Socket.IO 4 server (see §4, §8, §9)
├── server.js                   entry point — wires REST routes + socket controllers
├── routes/api/                 auth, health, clientPortfolio, payment, merchant (see §19/§20 — merchant not wired up)
├── controllers/                one Socket.IO controller per domain (account, chat, product, shop, trade, news, tournament, decklist, country, tcgcategories)
├── modules/                    db.module.js (MySQL pool), mailer.module.js
└── public/uploads/{products,avatars}/   multer upload targets

../Database/                    schema only, no migration tooling found
├── All.sql / All.dbml / All.dbdiagram
```

Not documented: `node_modules/`, `dist/` (build output), the unrelated `Portfolio_*` sibling projects.

## 3. Technology Stack

**Frontend (this app, from `package.json`):**
- React 19.2, React DOM 19.2
- Vite — aliased to `rolldown-vite@7.2.5` via `overrides`/`devDependencies` (not the standard `vite` package — don't "fix" this)
- Tailwind CSS 3.4 + PostCSS + Autoprefixer
- ESLint 9 (flat config) with `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Listed but **not currently imported anywhere in `src/`**: `react-router-dom` 7.10, `socket.io-client` 4.8, `framer-motion` 12, `lightweight-charts` 5, `mysql2` 3.16, `express` 5, `cors` 2.8. Verify before relying on any of these — they're likely leftovers from the pre-reset app.

**Backend (`../Backend/package.json`):**
- Node.js (ESM, `"type": "module"`), Express 5, Socket.IO 4
- MySQL via `mysql2` (connection pool)
- Auth: `bcrypt`/`bcryptjs`, `jsonwebtoken`
- Payments: `cybersource-rest-client` (CyberSource REST API)
- Email: `nodemailer`
- Uploads: `multer`
- Dev: `nodemon`

**Database:** MySQL/MariaDB — schema defined in `../Database/All.sql` / `.dbml`.

## 4. Application Architecture

```text
React SPA (NanashiCollectibles/src)
   ↓  fetch/REST + socket.io-client         [not currently wired up — see §1]
Express + Socket.IO (Backend/server.js)
   ├── REST routes (routes/api/*.routes.js) — auth, health, client-portfolio, payments
   ├── Socket.IO controllers (controllers/*.controller.js) — account, chat, product, shop,
   │   trade, news, tournament, decklist, country, tcgcategories — one controller per domain,
   │   each registers its own event handlers when a socket connects (Backend/server.js:279-288)
   ↓  mysql2 pool (Backend/modules/db.module.js)
MySQL (Database/All.sql schema)
```

- API communication and real-time state both live in `Backend/`; there is currently no client-side code in this app that calls either.
- Product data can be served two ways depending on config: from the DB (`USE_DB_PRODUCTS` env var) or from an in-memory `stores.products` Map (see `Backend/routes/api/merchant.routes.js` and `Backend/server.js`) — check which mode is active before assuming products persist.
- File uploads (product images, avatars) go through `multer` straight to `Backend/public/uploads/...`.

## 5. Routing

**None currently.** `src/main.jsx` renders `<App />` directly with no `BrowserRouter` or route table — `react-router-dom` is installed but unused. There is no route list to document until routing is reintroduced.

## 6. Important Components

**None currently** — `src/App.jsx` is the unmodified Vite starter (a header, a counter button, a footer, all inline-styled). No navigation, auth, modal, card, form, layout, or error-boundary components exist in `src/` right now.

## 7. Data Flow

- **Static data:** none in `src/` currently (a prior `src/data/` module existed and was deleted — see `git status`).
- **REST APIs / Socket.IO:** defined and functional in `../Backend/` (see §4), but nothing in this app's `src/` currently calls them.
- **Database-backed information:** authoritative source is MySQL via `Backend/modules/db.module.js`, when a given controller/route is wired to use it (some backend logic falls back to in-memory stores — see §4).
- **localStorage/sessionStorage, React Context:** none present in current `src/`.
- **Environment variables:** `.env` in this folder defines `VITE_SOCKET_URL` and `VITE_API_BASE` (see §10), but nothing in `src/` reads them yet.
- **Authoritative source, once rebuilt:** the MySQL database via the Backend API/socket layer should be treated as the source of truth for persistent data; anything in the frontend should be considered a cache/view of it.

## 8. Authentication

**Frontend:** no authentication code exists in `src/` currently (a prior `src/authStorage.js` and `src/pages/login/*` existed and were deleted — see `git status`). No protected routes, since there's no router.

**Backend — REST JWT auth (`Backend/routes/api/auth.routes.js`, mounted at `/api/auth`), this is real/working:**
- `POST /api/auth/register` — validates name/email/phone/password, hashes password with `bcrypt` (rounds from `BCRYPT_ROUNDS` env, default 10), inserts into `PERSONAL_USER`, returns a signed JWT.
- `POST /api/auth/login` — looks up by email, compares password with `bcrypt.compare`, returns a signed JWT.
- `GET /api/auth/me` — protected by a `requireAuth` middleware that verifies `Authorization: Bearer <token>` against `JWT_SECRET`.
- JWT secret: read from `process.env.JWT_SECRET`; in non-production with no `JWT_SECRET` set, it falls back to a random in-memory secret generated at boot (tokens invalidate on restart) and logs a warning. Production throws if `JWT_SECRET` is missing.
- Roles: a `ROLE` column on `PERSONAL_USER`, normalized to uppercase; `PORTFOLIO` is one known role value (used to gate the portfolio-client feature, `Backend/routes/api/clientPortfolio.routes.js`) — **Needs clarification**: what other role values exist (e.g. is there a merchant/admin role on this same table)?

**Backend — separate merchant auth (`Backend/routes/api/merchant.routes.js`):** a dev-only scheme — `POST /auth/login` compares a plaintext password against an in-memory `stores.merchants` map and returns `token: merchant.email` (the token *is* the email — no signing, no expiry). **This route file is not mounted in `Backend/server.js`** (only `health`, `auth`, `client-portfolio`, and `payments` are mounted — see §19/§20), so it is currently dead code, not a live vulnerability, but it must not be wired up as-is.

## 9. Database

- **Engine:** MySQL (connected via `mysql2/promise` pool in `Backend/modules/db.module.js`).
- **Schema source:** `Database/All.sql` (DDL) and `Database/All.dbml`/`All.dbdiagram` (ER model).
- **Tables (from `All.dbml`):** `PERSONAL_USER`, `RESET_PASSWORD`, `ACCOUNTS`, `SHOP`, `PRODUCTS`, `MANAGE_INVENTORY`, `CATEGORIES`, `DISCOUNTS`, `ORDERS`, `CARTS`, `WISHLISTS`, `REVIEWS`, `PAYMENTS`, `DELIVERIES`, `TRADE_LISTINGS`, `TRADE_OFFERS`, `CARD_GAMES`, `SINGLES`, `HISTORY_PURCHASE`, `TOURNAMENT`, `PARTICIPANTS`, `POINT_SYSTEM`, `PRIZES`, `PRIZE_POINT`, `NEWS`.
- **Relationships:** defined in `Database/All.dbml`/`All.dbdiagram` — read that file directly rather than relying on a summary here, since relationship details weren't independently re-derived for this document.
- **Files that access the DB:** `Backend/modules/db.module.js` (pool/connection), `Backend/routes/api/auth.routes.js` (queries `PERSONAL_USER` directly), and each `Backend/controllers/*.controller.js` (queries its own domain tables — not individually audited here).
- Credentials are never stored in this repo's tracked files beyond variable *names* in `.env.dev` (see §10) — no passwords found in the codebase during this audit.

## 10. Environment Configuration

**This app — `NanashiCollectibles/.env`:**
```env
VITE_SOCKET_URL=   # Socket.IO server URL (dev: http://localhost:3001/3002; prod: server.nanashicollectibles.com)
VITE_API_BASE=     # REST API base URL, same host as above
```
Currently unused by any code in `src/`.

**Backend — `Backend/.env.dev`:**
```env
PORT=
CLIENT_URL=
EXTRA_ORIGINS=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_DATABASE=
MYSQL_PASSWORD=
BCRYPT_ROUNDS=
RESET_TOKEN_TTL_MIN=
DB_BOOTSTRAP=
USE_DB_PRODUCTS=
CYBERSOURCE_RUN_ENVIRONMENT=
CYBERSOURCE_MERCHANT_ID=
CYBERSOURCE_KEY_ID=
CYBERSOURCE_SHARED_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```
`JWT_SECRET` and `JWT_EXPIRES_IN` are also read by `auth.routes.js` but are **not present** in `Backend/.env.dev` — confirmed via source read, not guessed. **Needs clarification**: is `JWT_SECRET` set some other way in the real dev/prod environment, or is auth currently running on the random-per-boot fallback?

Values are never included here — only variable names, per instruction.

## 11. Development Commands

**This app (`NanashiCollectibles/`):**
```bash
npm install
npm run dev       # vite dev server, http://localhost:5173 (see vite.config.js allowedHosts)
npm run build     # vite build → dist/          (verified: succeeds as of this audit)
npm run lint      # eslint .                    (verified: 1 pre-existing error, see §20)
npm run preview   # preview the production build
```
No test script exists in `package.json` — there is no test runner configured in this app.

**Backend (`../Backend/`), separate install/run, not started by anything in this folder:**
```bash
npm install
npm run dev       # nodemon server.js
npm start         # node server.js
```
No `build`, `lint`, or test script exists in `Backend/package.json`.

The old README described an `npm run dev:all` (via `concurrently`) to run both apps together — that script is **not present** in the current `package.json`; do not assume it works.

## 12. Coding Conventions

- Preserve the existing architecture unless there is a strong technical reason to change it.
- Prefer reusable components over duplicated markup.
- Keep components maintainable.
- Do not unnecessarily rewrite working code.
- Avoid introducing dependencies unless necessary.
- Follow the project's existing naming conventions.
- Keep imports organized.
- Remove unused imports after changes.
- Use defensive null/undefined handling where external or asynchronous data is involved.
- Avoid hard-coding values that already exist in configuration or data files.
- Preserve responsive behaviour.
- Preserve accessibility.
- Preserve existing business logic unless the requested feature requires changing it.

## 13. UI / Design Rules

`src/index.css` still contains a **dark "fantasy/hologram" theme** left over from before the reset, even though the current bare `App.jsx` doesn't use it: a page-body gradient (`from-slate-950 via-purple-950/30 to-slate-950`, `text-amber-50`), a custom purple/amber scrollbar, and two reusable effect classes — `.hologram-btn` / `.hologram-btn-rose` (glitching double-text label + animated scan line, teal vs. rose color variants) and `.neon-pulse` (cyan pulsing-ring effect). `public/assets/game-bg/` also still has 7 full-page background images (auth/cart/chat/news/profile/shop/trade) matching the deleted pages' names.

Treat these as the established design language to reuse/extend when UI is rebuilt, unless told otherwise:
- Dark, purple/amber/teal "TCG hologram" aesthetic — not a generic light SaaS look.
- `tailwind.config.js` has no custom theme extension yet (`theme.extend` is empty) — colors above are used as raw Tailwind utilities/arbitrary values, not defined tokens. If rebuilding, consider promoting the recurring colors into `theme.extend` rather than repeating raw values.
- No breakpoint customization — Tailwind defaults are in effect.
- `framer-motion` is installed (likely for page/route transitions, matching the deleted `AnimatedRoutes.jsx` file named in `git status`) but currently unused.

When modifying UI: maintain consistency with this existing design language, don't redesign unrelated areas, preserve mobile responsiveness, reuse existing classes/assets above rather than inventing new one-off styles, and use `framer-motion` (already a dependency) rather than ad-hoc animation libraries if motion is needed.

## 14. React Rules

- Use functional components.
- Follow React hook rules.
- Avoid unnecessary state.
- Avoid unnecessary `useEffect`.
- Memoize expensive derived values only where useful.
- Keep dependencies correct.
- Do not mutate state directly.
- Prevent undefined/null values from crashing rendering.
- Use optional chaining and proper fallbacks where appropriate.
- Avoid unnecessary re-renders.
- Preserve React Router behaviour once routing is reintroduced.

## 15. API / Backend Rules

- Verify frontend/backend contracts before changing either side.
- Preserve backward compatibility when practical.
- Validate user input (existing pattern: `Backend/routes/api/auth.routes.js` uses an explicit allow-list of body fields plus regex validation — follow this pattern for new routes).
- Use parameterized SQL queries (existing backend code consistently uses `db.query(sql, [params])` — keep doing this, never string-concatenate user input into SQL).
- Never expose secrets to frontend code.
- Handle errors appropriately; existing routes return JSON `{ message }` (and sometimes `{ ok, ...}`) with correct HTTP status codes — follow this shape for consistency.
- Avoid leaking stack traces or database details to users (existing code logs details server-side via `console.error` and returns a generic message to the client — follow this pattern).
- Keep authentication/authorization checks server-side.

## 16. Security Rules

Claude must never:
- commit `.env`
- expose credentials
- hard-code passwords
- expose API keys
- expose JWT secrets
- expose database passwords
- weaken authentication to solve a bug
- remove authorization checks just to make a feature work
- trust frontend authorization alone
- construct unsafe SQL using raw user input

If a requested solution creates a security vulnerability, explain the risk and implement a safer solution instead.

Specific things found in this audit worth keeping in mind:
- `Backend/routes/api/payment.routes.js` accepts raw card number/expiry/CVV in the request body and forwards them directly to CyberSource. This means this Express server is in the request path for raw PAN data — a PCI-DSS scope consideration if this goes to real production traffic. Not something to "fix" unilaterally; flag it if asked to touch payment code.
- The unmounted `merchant.routes.js` dev-auth scheme (plaintext password compare, token = email, no expiry — see §8) must not be turned on without a real rewrite.

## 17. Debugging Rules

When an error is reported:
1. Read the full error first.
2. Identify the first meaningful application error.
3. Trace it to the relevant source file.
4. Determine the root cause before modifying code.
5. Fix the root cause rather than suppressing the error.
6. Check for related regressions.
7. Run available lint/build/tests afterward (`npm run lint`, `npm run build` in this app; there is no test suite yet).
8. Report exactly what was changed.

Do not change several unrelated systems simultaneously unless necessary.

## 18. Modification Rules

Before making a significant modification:
1. Inspect the relevant files.
2. Understand current data flow.
3. Identify dependencies.
4. Make the smallest correct change.
5. Keep existing functionality intact.
6. Verify imports and references.
7. Run build/lint/tests where available.

Do not replace large working files unnecessarily.

## 19. Files That Require Extra Care

- **`src/main.jsx`** — the app's mount point; currently minimal (no router/providers), but any global provider (router, context, error boundary) will be added here — easy to break the whole app with a bad edit.
- **`src/App.jsx`** — currently the entire UI. Will likely be decomposed as the app is rebuilt; changes here are effectively changes to the whole rendered page right now.
- **`Backend/server.js`** — the single wiring point for every REST route and every Socket.IO controller (see the `app.use(...)` and `io.on("connection", ...)` block). A mistake here can take down the entire API and every real-time feature at once.
- **`Backend/modules/db.module.js`** — the one MySQL connection pool every controller/route shares; a change here affects every DB-backed feature simultaneously.
- **`Backend/routes/api/auth.routes.js`** — the only real authentication implementation in the codebase; changes here affect login/register/session validity for all users.
- **`Database/All.sql` / `All.dbml`** — the schema every backend query assumes; changing a table/column here without updating every referencing controller will silently break queries.
- **`NanashiCollectibles/package.json` / `vite.config.js`** — `vite` is overridden to `rolldown-vite`; changing the `overrides` block or bumping `vite` normally will likely break the build.

## 20. Known Issues / Technical Debt

**Confirmed problems (verified in this audit):**
- `src/` has been reset to the bare Vite starter; the entire prior frontend (pages, components, API/socket client, auth storage — see full list in `git status`) is deleted from disk but not committed. This is either in-progress intentional work or accidental loss — confirm before doing anything that would make it harder to recover (e.g. don't run destructive git operations on these paths without checking first).
- `package.json` still lists `react-router-dom`, `socket.io-client`, `mysql2`, `express`, `cors`, `framer-motion`, `lightweight-charts` as dependencies, none of which are imported anywhere in the current `src/`.
- `npm run lint` fails with one error: `tailwind.config.js:2` — `'module' is not defined` (`no-undef`), because `eslint.config.js` only loads `globals.browser`, not Node globals, and `tailwind.config.js` uses CommonJS `module.exports` in a `"type": "module"` package. Doesn't break the build, but is a real, currently-failing lint run.
- `Backend/routes/api/merchant.routes.js` exists (full CRUD for merchant products/orders) but is **not imported or mounted** in `Backend/server.js` — the merchant portal API described in the old README is not currently reachable.
- `index.html`'s `<title>` ("Hobby Fest Brunei Darussalam") doesn't match the app/package name (`nanashicollectibles-office`) or the business name (NanashiCollectibles).
- `JWT_SECRET` / `JWT_EXPIRES_IN`, which `auth.routes.js` reads, are not present in `Backend/.env.dev` (see §10).

**Potential improvements (not verified as problems, just observations):**
- If routing is reintroduced, `framer-motion` (already installed) plus the deleted-but-named `AnimatedRoutes.jsx` suggest route-transition animation was a deliberate prior design choice worth preserving.
- The dark hologram theme in `index.css` and the `public/assets/game-bg/*` images are ready to reuse once pages come back — consider wiring `tailwind.config.js` `theme.extend` to formalize the recurring colors instead of raw utility values.

## 21. Current Project Decisions

(No explicit architectural decisions have been communicated yet beyond what's inferred from code. Add entries here as they're made, using this structure:)

```markdown
### Decision
Description

Reason:
...

Affected files:
...
```

## 22. Change Log / Recent Significant Work

- **2026-08-26** — `src/` reset to bare Vite starter (uncommitted); prior shop/chat/trade/news/login/profile app removed from disk pending a rebuild aligned with the broader multi-purpose business direction (see §1). `package.json` name changed to `nanashicollectibles-office`; `react-router-dom` removed from `main.jsx`.

(Do not log routine CSS/copy tweaks here — only architecture-level changes: auth changes, DB migrations, major new modules, routing redesigns, API migrations.)

---

## Working with this file (instructions for Claude Code)

Before doing substantial work on this repository:
1. Read this file.
2. Inspect the relevant source files directly — treat current source code as the final authority whenever it contradicts this document.
3. Update this file when an important architectural decision, dependency, workflow, or project-wide behavior changes (especially §20, §21, §22).

Keep this file a concise technical reference, not an activity log. Do not record every small change.
