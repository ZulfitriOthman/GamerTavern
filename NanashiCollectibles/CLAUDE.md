# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

- **Name:** NanashiCollectibles — confirmed brand for both the business and this frontend. (`package.json`'s `"name": "nanashicollectibles-office"` is an internal package name, left as-is.)
- **What it is:** The customer-facing frontend of NanashiCollectibles, one app inside the `GamerTavern` monorepo (git root is one directory above this folder — sibling projects are `Backend/`, `Database/`, and unrelated `Portfolio_Jae/Recce/Zulfitri` sites).
- **Business direction:** a multi-purpose platform spanning TCG ecommerce/community, collectibles/Gunpla/drone/computer-parts shop categories, professional services (drone, website, application development), and RVS esports tournament registration (starting with Apex Legends).
- **Architecture:** React 19 SPA (this folder) talking to a separate Express + Socket.IO backend (`../Backend/`) backed by MySQL (`../Database/`).
- **Current development status:** Phase 1 (frontend foundation), Phase 2 (auth architecture + RVS Esports/Tournament, the first live vertical), and Phase 3A (Socket.IO authentication/authorization hardening — backend-only) are complete. See §21/§22.

## 2. Repository Structure

```text
NanashiCollectibles/                  (this app — git root is one level up, at GamerTavern/)
├── src/
│   ├── app/App.jsx                   route table (react-router-dom v7, nested under Layout)
│   ├── main.jsx                      BrowserRouter > AuthProvider > SocketProvider > App
│   ├── index.css                     Tailwind directives + base styles, reduced-motion support
│   ├── config/site.js                single source of truth for nav items, business-domain content
│   ├── components/
│   │   ├── layout/                   Layout (Header+Outlet+Footer), Container, Section, Footer
│   │   ├── navigation/                Header (nav + Services dropdown + auth controls), MobileNav
│   │   └── ui/                       Button, Card, Badge, SectionHeading — design-system primitives
│   ├── features/
│   │   ├── auth/                     AuthContext.js, AuthProvider.jsx, authService.js, LoginPage.jsx,
│   │   │                             RegisterPage.jsx — see §8
│   │   └── tournament/                tournamentService.js, useTournaments.js, TournamentCard.jsx,
│   │                                  TournamentRegistrationForm.jsx, format.js
│   ├── services/socket/              SocketContext.js, SocketProvider.jsx — central Socket.IO client
│   └── pages/
│       ├── HomePage.jsx, ShopPage.jsx, ServicesPage.jsx, TcgPage.jsx, EsportsPage.jsx,
│       │   AboutPage.jsx, ContactPage.jsx, NotFoundPage.jsx
│       ├── services/                 ServiceDetailPage.jsx (shared template) + 3 wrapper pages
│       └── esports/                  TournamentListPage.jsx, TournamentDetailPage.jsx
├── public/assets/game-bg/            unused (pre-reset app leftovers)
├── index.html                        branded as NanashiCollectibles; Google Fonts link
├── vite.config.js                    **`allowedHosts` value is intentional — see §16, do not revert/edit**
├── tailwind.config.js                ESM; `ink`/`brand`/`gold`/`signal` color tokens + fonts
├── .env                              non-secret URLs only (see §10)
└── CLAUDE.md

../Backend/                           separate Express 5 + Socket.IO 4 server — see §4, §8, §9
├── server.js                         io.use() JWT handshake middleware added Phase 3A — see §8
├── routes/api/                       auth (uses modules/jwt.module.js), health, clientPortfolio,
│                                      payment, merchant (unmounted)
├── controllers/                      one Socket.IO controller per domain — see §8's access matrix
├── modules/
│   ├── db.module.js                  MySQL pool
│   ├── mailer.module.js
│   ├── jwt.module.js                 NEW (Phase 3A) — single source of JWT secret/sign/verify,
│   │                                  used by both REST auth and the socket handshake middleware
│   └── authz.module.js               NEW (Phase 3A) — requireAuthenticated/requireAdmin/
│                                      requireOwnerOrAdmin, all keyed off verified `socket.user`
├── env.example                       variable names only, see §10
└── public/uploads/{products,avatars}/

../Database/                          schema — All.dbml confirmed STALE for PARTICIPANTS, see §9
└── All.sql / All.dbml / All.dbdiagram
```

Not documented: `node_modules/`, `dist/`, the unrelated `Portfolio_*` sibling projects.

## 3. Technology Stack

**Frontend:** React 19.2, React Router DOM 7.10, Tailwind CSS 3.4 (ESM config), ESLint 9 with `eslint-plugin-react-hooks@7` (strict `set-state-in-effect`/`refs` rules — see §14), `socket.io-client` 4.8, Vite via `rolldown-vite@7.2.5` override.

**Backend (`../Backend/package.json`):** Node ESM, Express 5, Socket.IO 4, `mysql2`, `bcrypt` **and** `bcryptjs` (both present, redundant — see §8), `jsonwebtoken`, `cybersource-rest-client`, `nodemailer`, `multer`, `nodemon`. `node_modules` installed as of Phase 3A (previously absent) for isolated local testing — see §20/§22.

**Database:** MySQL/MariaDB, schema in `../Database/All.sql`/`.dbml`. `Backend/.env.dev` points `MYSQL_HOST` at a remote hosted instance (`*.mysecurecloudhost.com`) with `CLIENT_URL=https://nanashicollectibles.com` — **this looks like the production-linked database.** Never run the Backend against it for testing without explicit sign-off; see §9's `DB_BOOTSTRAP` finding and §21.

## 4. Application Architecture

```text
React SPA (this app)
   ↓  fetch (REST)                              features/auth
   ↓  socket.io-client, auth: { token }          services/socket
Express + Socket.IO (Backend/server.js)
   ├── io.use() JWT handshake middleware — sets socket.user (verified) or null (guest)
   ├── REST routes — auth (real), health, client-portfolio, payments (merchant unmounted)
   ├── Socket.IO controllers — account, chat, product, shop, trade, news, tournament, decklist,
   │   country, tcgcategories — each now derives identity from `socket.user`, not the payload
   ↓  mysql2 pool (Backend/modules/db.module.js)
MySQL (Database/All.sql schema)
```

Only **Tournament** is wired end-to-end from the frontend. Shop, TCG categories, and News are confirmed publicly-readable but not yet connected — recommended next slice (§21).

## 5. Routing

`src/app/App.jsx` — unchanged since Phase 2:

```text
/, /shop, /services(+3 sub-pages), /tcg, /about, /contact, /login, /register, *
/esports                               RVS Esports landing
/esports/tournaments                   Live tournament list (backend-connected)
/esports/tournaments/:id               Tournament detail + registration (numeric TOURNAMENT.ID)
```

## 6. Important Components

Unchanged since Phase 2 — see `Layout`, `Header`/`MobileNav`, `ui/` primitives, `AuthProvider`, `SocketProvider`, `TournamentRegistrationForm`, `ServiceDetailPage`. Phase 3A made no frontend changes.

## 7. Data Flow

Unchanged since Phase 2 (`config/site.js` for static content, `authService.js` for REST, feature-level socket wrappers for realtime). The one behavioral change: `tournament:join`/`tournament:leave` now ignore any `userId` the frontend sends and derive identity from the authenticated session server-side — the existing frontend code already only ever sent the correct value, so this is invisible to the UI (see §8).

## 8. Authentication

### Canonical auth system (unchanged decision)

**REST JWT auth (`Backend/routes/api/auth.routes.js`, mounted at `/api/auth`) is canonical.** `POST /register`, `POST /login`, `GET /me`. `signToken`/`getJwtSecret`/`verifyToken` now live in **`Backend/modules/jwt.module.js`** (extracted in Phase 3A so REST and the new Socket.IO middleware share one implementation, one secret, one cache — `auth.routes.js` was updated to import from it instead of keeping its own copy). Behavior is unchanged: production throws on boot if `JWT_SECRET` is missing; dev falls back to a cached random secret with a warning.

### Socket.IO authentication (fixed in Phase 3A)

**Model:** identity (who the caller is) is now handled centrally by an `io.use()` handshake middleware in `Backend/server.js`; authorization (what they can do) stays per-controller, using shared helpers.

```js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) { socket.user = null; return next(); }      // no token -> guest
  try {
    const decoded = verifyToken(token);                    // same secret/verify as REST
    socket.user = { id: decoded.sub, email: decoded.email, name: decoded.name, role: decoded.role };
  } catch {
    socket.user = null;                                     // invalid/expired/malformed -> guest, NEVER authenticated
  }
  next();                                                   // always allow the connection through
});
```

- **`socket.user` shape:** `{ id, email, name, role }` — only fields taken from a cryptographically verified JWT, never copied from client claims. `null` means guest.
- **The connection is never rejected** for a missing/bad token — public functionality (tournament list/detail, guest registration, future public Shop/TCG/News reads) must keep working for anonymous sockets. A bad token degrades to guest rather than blocking the socket.
- **Every per-event `payload.userId` / `payload.currentUser` / `payload.adminId`-style identity field has been removed** from every controller's authorization decisions. Resource-id fields (`tournamentId`, `productId`, `id`, etc.) were left untouched — those are legitimate client input identifying *what*, not *who*.

**`Backend/modules/authz.module.js`** (new, shared, small — used by every controller that needs it):
```text
requireAuthenticated(socket)          -> { ok, user } | { ok:false, code:"AUTH_REQUIRED" }
requireAdmin(socket)                  -> also requires socket.user.role === "ADMIN" (case-insensitive)
                                          -> { ok:false, code:"ADMIN_REQUIRED" }
requireOwnerOrAdmin(socket, ownerId)  -> socket.user.id === ownerId, or admin
                                          -> { ok:false, code:"NOT_OWNER" }; null ownerId fails closed
```
All three trust only `socket.user` (set once, server-side, at handshake). `requireAdmin`/ownership checks trust the **role embedded in the JWT** rather than re-querying the DB per call (except `product.controller.js`/`tcgcategories.controller.js`, which kept their pre-existing live `resolveRoleFromDb` lookup — only the *input* to that lookup changed, from a spoofable payload field to the verified `socket.user.id`). **Trade-off, consistent with the existing REST `/me` behavior:** a role change (e.g. promotion/demotion) only takes effect after the affected user's token is reissued (next login) for the JWT-trusting paths — this is not a regression, it's how the canonical REST auth already worked.

Ack error responses now include both `code` (new, additive) and `message` (unchanged, still the primary field the frontend reads) — backward compatible with `features/tournament/tournamentService.js`.

### Socket.IO authorization matrix (confirmed via full source read, Phase 3A)

| Event(s) | Controller | Access | Identity source |
|---|---|---|---|
| `tournament:list`, `news:list`, `decklist:list`, `tcgcategories:list`, `country:list`, `product:list`, `trade:list` | various | Public read | none needed |
| `tournament:join` | tournament | Public — guest (name) or authenticated | `socket.user.id` if present, else `payload.guestName` |
| `tournament:leave` (own entry) | tournament | Authenticated, self only | `socket.user.id` |
| `tournament:leave` (by `participantId`) | tournament | Owner or Admin | `socket.user` via owner/role check |
| `tournament:create/update/delete` | tournament | Admin | `requireAdmin(socket)` |
| `news:create/update/delete`, `decklist:create/update/delete` | news, decklist | Admin | `requireAdmin(socket)` |
| `tcgcategories:create` | tcgcategories | Vendor or Admin | `socket.user.id` → live DB role lookup |
| `product:create/update/delete/inventory:adjust/image:upload` | product | Vendor(owner) or Admin | `socket.user.id` → live DB role lookup + DB-loaded owner comparison |
| `trade:create` | trade | Authenticated | `socket.user.id` |
| `trade:delete` | trade | Owner only | `socket.user.id` vs. DB-loaded `USER_ID` |
| `account:create`, `account:login`, `account:requestReset`, `account:resetPassword` | account | Public (pre-auth flows by nature) | n/a — unchanged, not part of canonical auth (§21) |
| `account:update` | account | **Owner or Admin — FIXED, previously had no check at all** | `requireOwnerOrAdmin(socket, payload.id)` |
| `user:join`, `product:new`, `cart:add` (shop), `chat:*` | shop, chat | Public, no identity concept | unchanged — legacy/demo session-scoped presence, not tied to accounts; nothing to spoof |

### Frontend auth architecture

Unchanged since Phase 2 (`AuthProvider`/`AuthContext`, `authService`, Login/Register pages, `localStorage` token, `SocketProvider` sends the JWT via the handshake `auth: { token }` field). **That handshake token is now actually verified server-side** — Phase 2 sent it forward-compatibly before any backend support existed; Phase 3A is the backend catching up. No frontend code changed.

## 9. Database

- **Engine:** MySQL, via `mysql2/promise` pool in `Backend/modules/db.module.js`.
- **Schema source of truth (resolved, Phase 3B): `Database/All.sql` is accurate and current** — verified by direct comparison against `tournament.controller.js`'s queries. Its `PARTICIPANTS` table has `USER_ID INT NULL REFERENCES PERSONAL_USER(ID)`, `GUEST_NAME`, `NICKNAME`, `TEAM_NAME`, plus a `UNIQUE KEY (TOURNAMENT_ID, USER_ID)` (MySQL allows multiple NULLs in a unique key, so this doesn't block multiple guest registrations) — this matches the live code exactly. **Only `Database/All.dbml`/`All.dbdiagram` (the ER *diagrams*) are stale** (they still show `PARTICIPANTS.ACCOUNT_ID -> ACCOUNTS`, not `USER_ID -> PERSONAL_USER`) — they were generated from an older version of `All.sql` and never regenerated. If schema diagrams are ever refreshed, regenerate them *from* `All.sql`, not the other way around.
- **Backend startup path (confirmed, Phase 3B) — no automatic schema management of any kind:**
  1. `server.js` → `dotenv.config({ path: "Backend/.env.dev", override: true })`.
  2. `initDB()` (`db.module.js`) creates a `mysql2` connection **pool** — this does not connect yet (lazy).
  3. `start()` calls `dbPing()` once at boot; on failure it just logs a warning and sets `isHealthy = false` — it does not crash, retry-loop, or mutate anything.
  4. `httpServer.listen(PORT)`.
  There is **no migration runner, no `.sql` file ever executed by the app, no seed logic anywhere in `Backend/`** (confirmed by repo-wide grep for `CREATE TABLE`/`migrate`/`seed`/`bootstrap` and a glob for `*.sql` — nothing found outside `Database/All.sql` itself, which nothing in `Backend/` reads). **The backend requires the schema in `Database/All.sql` to already exist** in whatever database `MYSQL_*` points at; it will not create it.
- **`DB_BOOTSTRAP` env var: dead / not wired to any code** (confirmed via full-repo grep). Appears in `Backend/.env.dev` (`true`) and `env.example` only. Does nothing today — don't treat it as a safety net or a risk.
- **Tables:** `PERSONAL_USER`, `RESET_PASSWORD`, `ACCOUNTS`, `SHOP`, `PRODUCTS`, `MANAGE_INVENTORY`, `CATEGORIES`, `DISCOUNTS`, `ORDERS`, `CARTS`, `WISHLISTS`, `REVIEWS`, `PAYMENTS`, `DELIVERIES`, `TRADE_LISTINGS`, `TRADE_OFFERS`, `CARD_GAMES`, `SINGLES`, `HISTORY_PURCHASE`, `TOURNAMENT`, `PARTICIPANTS`, `POINT_SYSTEM`, `PRIZES`, `PRIZE_POINT`, `NEWS`.
- No destructive migrations, no renaming existing tables, never touch `information_schema` or other MariaDB system schemas.

**`render.yaml` finding (Phase 3B):** lives inside `NanashiCollectibles/` (the frontend folder) despite describing the `nanashicollectibles-server` Backend service, and its `startCommand: npm run server:prod` **does not exist** in `Backend/package.json` (only `start`/`dev`/`server` do — see §11). Only `NODE_ENV`/`CLIENT_URL` are set there; every other secret (`MYSQL_*`, `JWT_SECRET`, etc.) must be configured directly in Render's dashboard for the real deployment — confirming `Backend/.env.dev` is a **local-only developer convenience file**, not something the production deploy reads. Not fixed this phase (deployment config, out of scope for security hardening) — flagging for whoever next touches deployment.

**Environment separation — recommended, not implemented (blocked, see Phase 3B report):**
```text
Production   -> Production DB (mysecurecloudhost.com) — already isolated via Render's own env var dashboard, not this repo
Development  -> a separate, disposable Dev DB — Backend/.env.dev should point here, not at production
Testing      -> an isolated/disposable Test DB, or continue using unit-level mocks (Phase 2/3A's approach)
```
This environment has no MySQL server, MySQL client, or Docker installed (confirmed: `which docker/mysql/mysqld/mariadb` all not found, nothing listening on `:3306`) — a real integration-tested Dev/Test DB could not be created without the owner installing one of those or providing connection details to an existing isolated instance. See Phase 3B's completion report for options.

## 10. Environment Configuration

**This app — `NanashiCollectibles/.env`** (unchanged): `VITE_SOCKET_URL`, `VITE_API_BASE`.

**Backend — `Backend/.env.dev`** (real file, gitignored, points at the production-linked DB — see §3/§9) **and `Backend/env.example`** (names only, tracked):
```env
PORT= CLIENT_URL= EXTRA_ORIGINS=
MYSQL_HOST= MYSQL_PORT= MYSQL_USER= MYSQL_DATABASE= MYSQL_PASSWORD=
JWT_SECRET= JWT_EXPIRES_IN=
BCRYPT_ROUNDS= RESET_TOKEN_TTL_MIN= DB_BOOTSTRAP= USE_DB_PRODUCTS=
CYBERSOURCE_RUN_ENVIRONMENT= CYBERSOURCE_MERCHANT_ID= CYBERSOURCE_KEY_ID= CYBERSOURCE_SHARED_SECRET=
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS= SMTP_FROM=
```
Unchanged this phase. Values are never included here — only variable names.

## 11. Development Commands

**This app:** `npm install`, `npm run dev`, `npm run build` (verified), `npm run lint` (verified, 0 errors), `npm run preview`. No test runner.

**Backend (`../Backend/`):** `npm install`, `npm run dev` (nodemon), `npm start`. No `build`/`lint`/test script exists — confirmed again in Phase 3A. `node_modules` was installed during Phase 3A for isolated local unit testing (see §22); it wasn't present before.

**Do not run the Backend against `Backend/.env.dev`** for exploration or testing — it points at what looks like the production database. Phase 3A's security logic was verified instead via a standalone script that imports `modules/jwt.module.js`/`modules/authz.module.js` directly and exercises them with constructed fake tokens/sockets — no server boot, no database, no `.env.dev` involvement. That script was deleted after use; recreate a similar one rather than booting the real server if you need to re-verify this logic.

## 12. Coding Conventions

Unchanged — see prior phases. Backend addition: put shared, cross-cutting server logic (JWT, authorization) in `Backend/modules/*.module.js` and import it, rather than duplicating a local copy per controller (this is exactly what Phase 3A fixed — `requireAdmin` had been copy-pasted nearly verbatim into `tournament.controller.js`, `news.controller.js`, and `decklist.controller.js`).

## 13. UI / Design Rules

Unchanged since Phase 2 — no frontend changes this phase.

## 14. React Rules

Unchanged since Phase 2 (`react-hooks/set-state-in-effect`/`refs` guidance still applies — see prior version of this doc / git history if needed). No frontend changes this phase.

## 15. API / Backend Rules

- Verify frontend/backend contracts before changing either side — read the controller, don't infer from grep alone (this cost real time in Phase 2: a grep-based claim about tournament/news/decklist "having JWT auth" was wrong).
- Use parameterized SQL — every query already does this; never string-concatenate.
- **Identity (who the caller is) must come from `socket.user` for Socket.IO, or `req.user`/`requireAuth` for REST — never from a client-supplied payload/body field.** This is the core rule Phase 3A exists to enforce; don't reintroduce a `payload.userId`-style check when adding new socket events.
- Resource identifiers (`tournamentId`, `productId`, etc.) are legitimate client input and are unaffected by the above — don't confuse the two categories.
- Use the shared helpers (`requireAuthenticated`/`requireAdmin`/`requireOwnerOrAdmin` from `modules/authz.module.js`) for new authorization checks rather than writing a new one-off per controller.
- Never expose secrets, stack traces, or DB structure to clients.

## 16. Security Rules

Never: commit secrets, hard-code credentials, weaken auth to solve a bug, remove authorization checks to make a feature work, trust frontend-supplied identity, or build unsafe/string-concatenated SQL.

**Confirmed findings, Phase 3A status:**
- **Socket.IO authentication — FIXED.** `io.use()` JWT middleware now verifies the handshake token; every controller's authorization check now uses `socket.user` instead of a spoofable payload field. See §8 for the full matrix.
- **`account:update` had no ownership check at all (not just spoofable — completely open)** — any connected socket could edit any user's profile fields by guessing an id. **Fixed** via `requireOwnerOrAdmin`.
- **Remaining, accepted trade-off — JWT role lifetime (quantified, Phase 3B):** `requireAdmin`/`requireOwnerOrAdmin` trust the role embedded in the JWT at login time, not a fresh DB lookup (except `product`/`tcgcategories`, which already did fresh lookups and were left that way). `JWT_EXPIRES_IN` is unset in `Backend/.env.dev`, so the actual runtime default is **`jsonwebtoken`'s `7d`** — a demoted/deactivated admin keeps admin socket privileges (and a valid REST session) for **up to 7 days** unless they log out or the value is changed. Same characteristic the canonical REST `/me` already has, not a new gap. Recommendation (not implemented — no code change without a specific ask): if this exposure window is unacceptable, the lowest-effort fix is setting a shorter `JWT_EXPIRES_IN` (e.g. `1d` or `1h`) in `.env.dev`/production config; token versioning or a refresh-token architecture would close the gap more precisely but is real added complexity — don't build either speculatively.
- **Payments (`Backend/routes/api/payment.routes.js`)** — untouched, still requires a dedicated security review before any expansion. Do not modify CyberSource/PAN/CVV/checkout code.
- **Merchant auth (`merchant.routes.js`)** — confirmed unsafe, confirmed unmounted, untouched, must stay that way.
- **`shop.controller.js`, `chat.controller.js`, `country.controller.js`** have no identity concept at all (session-scoped, not account-tied) — nothing to spoof, out of scope for this hardening pass, not touched.
- **`NanashiCollectibles/vite.config.js`'s `allowedHosts` value is intentional (confirmed instruction, Phase 3A) — do not revert or modify it**, including "cleaning up" an apparent dev-server-triggered change. (Earlier phases treated an observed rewrite of this value as accidental and reverted it; that assumption was wrong — the current value is deliberate. If `npm run dev` appears to rewrite this file again, leave the result as-is rather than reverting.)
- `Backend/.env.dev` points at what looks like the production database (§3/§9) — be deliberate about ever running the Backend locally against it. `DB_BOOTSTRAP=true` in that file does nothing today (§9) — don't assume it's a safety net or a risk; it's simply unused.

If a requested solution would create a new vulnerability, explain the risk and propose a safer approach instead of implementing it as asked.

## 17. Debugging Rules

Unchanged — see prior phases.

## 18. Modification Rules

Unchanged — see prior phases.

## 19. Files That Require Extra Care

- **`Backend/modules/jwt.module.js`** — the one JWT secret/sign/verify implementation shared by REST auth and the Socket.IO handshake; a bug here affects every authenticated request and connection at once.
- **`Backend/modules/authz.module.js`** — the one set of authorization helpers used across `account`/`tournament`/`news`/`decklist`; a bug here has the same blast radius as the vulnerability it fixed.
- **`Backend/server.js`**'s `io.use()` block — controls whether every socket connection gets guest or authenticated status; a mistake here could either lock out guests (breaking public functionality) or grant authenticated status to bad tokens.
- Everything listed in the Phase 1/2 versions of this section still applies (`src/app/App.jsx`, `AuthProvider.jsx`, `SocketProvider.jsx`, `Backend/routes/api/auth.routes.js`, `Database/All.sql`/`.dbml`).
- **`NanashiCollectibles/vite.config.js`** — `allowedHosts` is intentional, do not edit/revert (§16).

## 20. Known Issues / Technical Debt

**Confirmed problems:**
- **`tournament:join` has a TOCTOU race on capacity (found via code review, Phase 3B, not fixed — out of scope):** the `MAX_TEAMS` capacity check (`SELECT COUNT(*) ...`) and the `INSERT` happen as separate statements with no transaction or row lock between them. Two concurrent joins near the last open slot could both pass the check and both insert, exceeding capacity. The DB's `UNIQUE (TOURNAMENT_ID, USER_ID)` constraint prevents the *same* user from double-registering, but does not prevent over-capacity from two *different* users racing. Fix would be wrapping the check+insert in a transaction (e.g. `SELECT ... FOR UPDATE` on a capacity-tracking row, or re-checking count inside the same transaction as the insert) — not done, flagging only.
- `Database/All.dbml`/`All.dbdiagram` stale for `PARTICIPANTS` — `Database/All.sql` itself is confirmed accurate (§9).
- `merchant.routes.js` intentionally unmounted (unsafe dev-only auth).
- `shop.controller.js` (legacy in-memory demo) likely superseded by `product.controller.js` — not confirmed removable without checking other consumers.
- No enquiry-submission backend for `ContactPage.jsx`'s form.
- No `ProtectedRoute` / protected frontend pages exist yet (deliberately deferred).
- Two bcrypt packages (`bcrypt` + `bcryptjs`) doing the same job across REST vs. socket account systems.
- The socket-based `account.controller.js`'s two useful capabilities (password reset, richer registration validation) are still not ported into REST — recommended for Phase 3B/4, not done (Phase 3A scope was security fixes, not feature migration, per explicit instruction).
- Full integration testing against a real database has never been performed for the auth/authorization changes (Phase 2 or 3A) — only unit-level/mock verification. This is a real gap before calling the tournament vertical (or the hardened socket auth) production-ready — **blocked in Phase 3B by this environment having no MySQL/Docker available**; see Phase 3B's completion report for what's needed to close it.
- Other multi-step writes reviewed for the same TOCTOU class of bug (Phase 3B, code-review only): `product:create`, `inventory:adjust`, `product:delete`, and `account:resetPassword` already wrap their multi-statement writes in a real `conn.beginTransaction()`/`commit()` transaction — no issue found. `tournament:join` (above) is the one confirmed gap.

**Potential improvements:**
- `framer-motion` installed and unused.
- Consider consolidating `bcrypt`/`bcryptjs` to one package.
- Consider whether `requireAdmin`/`requireOwnerOrAdmin`'s JWT-cached-role trade-off (§16) is acceptable long-term, or whether a shorter `JWT_EXPIRES_IN` / a live DB role check (like `product`/`tcgcategories` already do) is worth the extra query cost.

## 21. Current Project Decisions

*(Phase 1/2 decisions — brand, `src/` reset, backend-as-infrastructure, merchant routes unmounted, payments out of scope, tournament uses real numeric IDs — all still stand, see git history for full text if needed.)*

### Decision: REST JWT is canonical; Socket.IO now has real authentication built on the same tokens
Confirmed no second JWT implementation was introduced — `Backend/modules/jwt.module.js` is shared by REST and Socket.IO. `account.controller.js` remains non-canonical for identity (issues no token); its password-reset and richer-validation capabilities are still recommended, not yet ported, for a future phase.

### Decision: Socket.IO never rejects a connection for a missing/invalid token
No-token and bad-token both resolve to `socket.user = null` (guest), preserving all existing public/guest functionality (tournament list/detail, guest registration). Only the *capabilities* granted to a connection are gated, never the connection itself.

### Decision: Identity for authorization always comes from `socket.user`, never from the event payload
Applied across `account`, `product`, `trade`, `tournament`, `news`, `decklist`, `tcgcategories`. `shop`/`chat`/`country` were left alone — they have no identity concept to fix.

### Decision: `account:update`'s missing ownership check was a real, unrelated bug — fixed
Found while auditing for spoofable identity trust; not merely spoofable, it had no check at all. Fixed with `requireOwnerOrAdmin`.

### Decision: `vite.config.js`'s `allowedHosts` value is intentional — do not touch it
Explicit instruction, Phase 3A (§16, §19). Supersedes the earlier-phase assumption that an observed change to this file was an unwanted side effect.

### Decision: Phase 3A verification used isolated unit-level tests, not the real database
`Backend/.env.dev` points at what looks like production (§3/§9). Attempting to write a safe local `.env.dev` for a real server-boot test was itself blocked by the environment's own permission system when attempted — respected rather than worked around. Verification instead exercised `jwt.module.js`/`authz.module.js` directly (26 assertions: token sign/verify/expiry/forgery, production fail-safe, dev-secret caching, every authorization helper outcome including the core spoofing-prevention case, and a faithful simulation of the `io.use()` handshake branching) — all passed. This is real but partial confidence: full integration testing (an actual client connecting to an actual running server with an actual database) has not been done — see §20.

### Decision: `Database/All.sql` is the schema source of truth; `All.dbml`/`All.dbdiagram` are stale diagrams only
Confirmed by direct comparison (Phase 3B) — `All.sql`'s `PARTICIPANTS` table matches `tournament.controller.js` exactly. The diagrams were generated from an older version of the SQL and never regenerated.

### Decision (blocked): Phase 3B could not create a real isolated Dev/Test database via Docker
This sandboxed environment has no MySQL server, MySQL client, or Docker available (confirmed: `docker`/`mysql`/`mysqld`/`mariadb` all absent from PATH, nothing listening on `:3306`). Superseded by the decision below — the owner is creating the database manually instead.

### Decision: database schema creation and all destructive database operations are manually controlled by the project owner
Claude may audit the schema, design/recommend table structures, and generate SQL — but must never create, drop, or import into any production or development schema automatically, and must never connect to or execute SQL against any real MySQL instance, unless explicitly authorized for that specific action. The owner reviews and runs all schema SQL manually (currently via MySQL Workbench). This supersedes the Docker-based plan above.

### Decision: moving toward a clean, coherent NanashiCollectibles schema rather than preserving stale legacy design
A full audit found `Database/All.sql` is accurate for the actively-used tables but that roughly 15 of its 24 tables have **zero references anywhere in the current backend** — orphaned by an abandoned `ACCOUNTS` (VARCHAR id) user model that was superseded by `PERSONAL_USER` (INT id) everywhere live code actually runs; two tables live code depends on (`CATEGORIES_TCG`, `COUNTRIES`) aren't in `All.sql` at all. The owner approved a greenfield v2 schema, `snake_case`/plural naming, `INT UNSIGNED AUTO_INCREMENT` PKs throughout, `utf8mb4`/`utf8mb4_unicode_ci` (chosen over newer collations since the exact target MySQL/MariaDB version isn't confirmed), no CHECK constraints (unreliable pre-8.0.16), and real relational structure for tournament teams (`tournament_teams`/`tournament_team_members`, cross-table tournament-consistency enforced via composite FKs, not triggers) rather than a free-text `team_name` label. **`Database/NanashiCollectibles_v2.sql` has been generated (19 tables) — nothing has been executed against any database; the owner runs it manually via MySQL Workbench.** Backend query migration and Phase 3B integration testing both still come after that, once the owner confirms the tables were created successfully. The legacy `Database/All.sql`/production database are untouched and not being retired yet.

## 22. Change Log / Recent Significant Work

- **2026-08-26 (Phase 1)** — Frontend foundation: routing, layout, design system, 11 static routes, rebrand, `tailwind.config.js` ESM fix, `Backend/env.example`.
- **2026-08-26 (Phase 2)** — Auth architecture audit (REST JWT confirmed canonical; socket `account.controller.js` confirmed non-canonical, issues no token) + RVS Esports/Tournament as the first live-connected vertical (list/detail/guest-or-authenticated registration/leave). Confirmed Socket.IO had no real authentication anywhere, deliberately deferred fixing it.
- **2026-08-26 (Phase 3A)** — Socket.IO authentication + authorization hardening (backend-only, no frontend changes). Added `Backend/modules/jwt.module.js` (shared secret/sign/verify, also adopted by `auth.routes.js`, removing a duplicate local copy) and `Backend/modules/authz.module.js` (`requireAuthenticated`/`requireAdmin`/`requireOwnerOrAdmin`). Added `io.use()` handshake middleware to `server.js`: no/bad token → guest (`socket.user = null`), never rejected. Replaced every spoofable `payload.userId`/`payload.currentUser`/`payload.adminId`-style identity check with `socket.user`-derived identity across `account`, `tournament`, `news`, `decklist`, `product`, `trade`, `tcgcategories` controllers (full matrix in §8). Fixed `account:update`, which had no ownership check at all. Confirmed `DB_BOOTSTRAP` is dead/unused in current code (§9). Verified via 26 isolated unit-level assertions (no server boot, no database) — see §21. `npm install` run for `Backend/` (previously had no `node_modules`). Frontend `lint`/`build` re-verified clean (no frontend changes made). `vite.config.js` left untouched per explicit instruction (§16).
- **2026-08-26 (Phase 3B)** — Attempted real database/integration validation; **blocked by missing MySQL/Docker in this environment** (no code changes made). Completed everything achievable without a live database: confirmed `Database/All.sql` (not the `.dbml`/`.dbdiagram` diagrams) is the accurate schema source of truth; audited the full backend startup path and confirmed no migration/seed/bootstrap logic exists anywhere (`DB_BOOTSTRAP` is dead code); found and documented a real TOCTOU capacity race in `tournament:join` (not fixed — flagged as technical debt); confirmed other multi-step writes (`product:create`, `inventory:adjust`, `product:delete`, `account:resetPassword`) are already correctly transactional; quantified the JWT role-trust exposure window at up to 7 days (`JWT_EXPIRES_IN` unset, defaults to `jsonwebtoken`'s `7d`); found `render.yaml`'s `startCommand` references a non-existent `server:prod` script. Frontend `lint`/`build` re-verified clean.
- **2026-08-26 (DB redesign, pre-Phase-3B)** — Owner pivoted away from Docker; will create the new database manually via MySQL Workbench and run all schema SQL themselves. Full audit of every table against every controller/route found ~15 of 24 tables in `Database/All.sql` are unreferenced by any live backend code (orphaned `ACCOUNTS`/`ORDERS`/`CARTS`/`WISHLISTS`/`REVIEWS`/`PAYMENTS`/`DELIVERIES`/`SHOP`/`DISCOUNTS`/`CARD_GAMES`/`SINGLES`/`HISTORY_PURCHASE`/`POINT_SYSTEM`/`PRIZES`/`PRIZE_POINT`/`TRADE_OFFERS`); also found two tables live code depends on (`CATEGORIES_TCG` used by `tcgcategories.controller.js`, `COUNTRIES` used by `country.controller.js`) that don't exist in `All.sql` at all. Two-round schema proposal review with the owner (naming/PK/module scope, then FK delete-behavior and tournament-team relational integrity) — both approved. **Generated `Database/NanashiCollectibles_v2.sql`** (19 tables: `users`, `password_reset_tokens`, `countries`, `product_categories`, `tcg_games`, `esports_games`, `news_categories`, `products`, `product_images`, `inventory_movements`, `deck_lists`, `tournaments`, `tournament_registrations`, `tournament_teams`, `tournament_team_members`, `trade_listings`, `news`, `services`, `enquiries`) — schema only, no seed data, no `CREATE`/`DROP DATABASE`, no destructive statements. Nothing executed against any database. Tournament team integrity (a team member's registration and a team's captain must belong to the same tournament) enforced via composite foreign keys, not triggers. **Next steps, in order: owner runs the SQL manually → confirms table creation → backend query migration → Phase 3B integration testing.** Not started yet.

(Do not log routine tweaks here — only architecture-level changes.)

---

## Working with this file (instructions for Claude Code)

Before doing substantial work on this repository:
1. Read this file.
2. Inspect the relevant source files directly — treat current source code as the final authority. Prefer reading actual code over grepping for keywords when the conclusion has security implications.
3. Update this file when an important architectural decision, dependency, workflow, or project-wide behavior changes (especially §20, §21, §22).

Keep this file a concise technical reference, not an activity log. Do not record every small change.
