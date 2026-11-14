# Mashoor — Catalog Sharing

Two websites on one API and database. The API is part of the shared
GamerTavern Backend (`D:\Github\GamerTavern\Backend`), mounted at `/api/mashoor`.

| Part | Folder | Dev URL |
|---|---|---|
| Admin Website (client staff) | `admin` | http://localhost:5301 |
| Vendor Portal (approved vendors) | `portal` | http://localhost:5302 |
| Mashoor API (Express 5 + SQLite), inside the shared Backend | `../../Backend/mashoor` | http://localhost:3002/api/mashoor |
| Shared frontend code (API client, auth, login page, styles) | `packages/shared` | — |

`admin` and `portal` are independent Vite projects, each with its own
`package.json` and `node_modules`. They import the shared code as
`@mashoor/shared/*`, which each `vite.config.js` aliases to `../packages/shared/src`.

Each Vite dev/preview server proxies `/api/mashoor` to the Backend, so session
cookies stay first-party. The proxy target defaults to `http://localhost:3002`;
override it with `API_URL` (shell or `admin/.env.local` / `portal/.env.local`,
see `.env.example`).

## Requirements

Node.js 24+ (the API uses the built-in `node:sqlite` module; no database server to install).

## Run all three components

Three terminals, from `D:\Github\GamerTavern`:

```sh
# 1. Backend (all GamerTavern APIs, including /api/mashoor) — port 3002
cd Backend
npm install            # first time only
npm run dev            # or: docker compose up   (see Backend/compose.yaml)

# 2. Admin website — port 5301
cd Listing-Sample/Mashoor/admin
npm install            # first time only
npm run dev

# 3. Vendor portal — port 5302
cd Listing-Sample/Mashoor/portal
npm install            # first time only
npm run dev
```

Shortcuts from this folder (`Listing-Sample/Mashoor`), after `npm install` here
(only installs `concurrently` + `oxlint`):

```sh
npm run install:all   # npm install in admin/ and portal/
npm run dev           # Backend + admin + portal together
npm run build         # builds admin/dist and portal/dist
```

## Accounts

Demo data for local development only (refuses to run with `NODE_ENV=production`).
From `Backend/`:

```sh
npm run mashoor:seed-dev
```

- Staff: `admin@mashoor.test` / `AdminPass123!`
- Vendors (usernames): `alice`, `bob`, `carol` / `VendorPass123!`
- Categories/listings: Vendor A → Office Chairs, Vendor B → Desks, Vendor C → none (empty catalog)

To create a real staff account (from `Backend/`):

```sh
npm run mashoor:create-staff -- --email you@company.com --name "Your Name"
```

If the Backend runs in Docker, run these inside the container instead, so only
one OS touches the SQLite file: `docker compose exec backend npm run mashoor:seed-dev`.

The database lives at `Backend/mashoor/data/mashoor.db` and listing images in
`Backend/mashoor/storage/` (both gitignored). Delete both to start fresh.

## Database migrations

Mashoor uses its own SQLite database. Its migrations are SQL files in
`Database/mashoor/migrations/` (`NNNN_description.sql`, see `Database/mashoor/README.md`),
separate from the shared MySQL migrations in `Database/migrations/` — never run them
against MySQL. They are applied **automatically** when the Backend starts (tracked by
`PRAGMA user_version`); there is no manual step. Docker mounts that folder read-only
(`Backend/compose.yaml`), so after pulling a compose change run `docker compose up -d`
in `Backend/`. If the folder is unreachable, the Backend still starts and logs why
`/api/mashoor` is disabled.

## Configuration (Backend env, all optional)

The Mashoor module reads only `MASHOOR_*` variables from the Backend's env file
(`Backend/.env.dev`; documented in `Backend/env.example`):

| Variable | Default |
|---|---|
| `MASHOOR_MODULE` | on (`off` disables `/api/mashoor`) |
| `MASHOOR_DB_PATH` | `Backend/mashoor/data/mashoor.db` |
| `MASHOOR_STORAGE_DIR` | `Backend/mashoor/storage` (private listing images) |
| `MASHOOR_MIGRATIONS_DIR` | `Database/mashoor/migrations` |
| `MASHOOR_ALLOWED_ORIGINS` | `http://localhost:5301,http://localhost:5302` |
| `MASHOOR_SESSION_TTL_HOURS` | `8` |
| `MASHOOR_COOKIE_SECURE` | `true` when `NODE_ENV=production` |

For the live sites, set
`MASHOOR_ALLOWED_ORIGINS=https://admin.nanashicollectibles.com,https://portal.nanashicollectibles.com`
(plus the localhost origins if you also develop against that Backend).

## Hosting the frontends

Both apps use client-side routing (`BrowserRouter`), so any nested URL such as
`/vendors/12` or `/account` must serve `index.html`. `vite` and `vite preview`
already do this. When serving `dist/` from another web server, add an SPA
fallback and proxy `/api/mashoor` to the Backend on the same origin, e.g. nginx:

```nginx
location /api/mashoor/ { proxy_pass http://127.0.0.1:3002; proxy_set_header X-Forwarded-For $remote_addr; }
location / { try_files $uri /index.html; }
```

The API sends no CORS headers on purpose: the browser must reach it on the
frontend's own origin (through a proxy), never cross-site.

## Tests

```sh
cd ../../Backend && npm run mashoor:test   # or `npm test` from this folder
npm run lint                               # from this folder
npm run build                              # from this folder, or in admin/ or portal/
```

## Access model

- Staff and vendors are separate account types with separate session cookies
  (`mashoor_staff` on `/api/mashoor/admin`, `mashoor_vendor` on `/api/mashoor/portal`;
  httpOnly, SameSite=Strict).
- Every `/api/mashoor/admin/*` route except login/logout requires an active staff session.
- State-changing requests from browser origins not in `MASHOOR_ALLOWED_ORIGINS` are rejected (CSRF guard).
- Each vendor login belongs to one vendor company. The company is read from the
  account on every request, never from the request body or URL.
- **Categories control visibility.** Staff assign one or more categories to each vendor
  company (every login of that company shares them). A vendor sees a catalog listing only if
  the listing is **published**, its **category is active**, that category is **assigned to
  the vendor's company**, and the company is **active**. Unpublished (draft), archived and
  uncategorized listings are never visible. That rule lives in one place,
  `Backend/mashoor/src/catalogAccess.js`, and every portal list/search/detail/image route
  uses it; ids sent by the browser only narrow the result, never grant access. Anything
  outside the rule answers 404. Changes apply on the vendor's next request.
  (`catalog_assignments` from the first schema is superseded and grants nothing.)
- The portal is read-only: vendors can change only their own password.
- **Vendor accounts use a username, not an email.** Staff sign in with email (unchanged);
  vendors sign in with a username + password. Email is not required anywhere for vendors
  (form, API or database) and is never used to sign in or recover a password. Usernames are
  case-insensitive and stored canonical (trimmed, lower-case; 3–40 of `a-z 0-9 . _ -`,
  starting with a letter or digit), unique across all vendor accounts. There is no public
  registration.
- **Password changes are optional.** Staff choose the password when creating an account, and
  when resetting or reactivating one. That password works immediately and stays valid until
  staff or the vendor change it; vendors go straight to their catalog (or the page they asked
  for) after signing in. A vendor may change their password in the portal under **Settings**
  (current password, new password, confirmation): the current password is verified (with the
  same attempt limit as sign-in), every other session of the account ends, and the browser
  gets a fresh session. Only scrypt hashes are stored; no response, list or log ever contains a
  password or hash. (`vendor_users.must_change_password` is no longer used; migration `0004`
  cleared it.)
- **Deactivate / reactivate** (per login account, admin list or vendor page): deactivation
  keeps the account, username, company, category assignments and history, ends its sessions
  immediately and rejects logins. Reactivation requires staff to set and confirm a new
  password; the old password and old sessions stay invalid, and the vendor signs in with the
  new password right away.
- **Forgotten password:** the portal says "Contact your administrator to reset your password."
  Staff use *Reset password* (admin only, no unauthenticated reset endpoint exists): it sets a
  new password, ends sessions, and does **not** reactivate an inactive account.
- Suspending a whole company (company status) also ends all of its accounts' sessions and
  blocks their logins.
- Accounts created before usernames existed (migration `0003`) have no username and cannot sign
  in until staff set one (vendor page → *Edit*). None existed in the live database when `0003`
  was applied.
- Listing images (PNG/JPEG/WebP/GIF, max 5 MB, type checked from the file contents) are
  stored privately under `MASHOOR_STORAGE_DIR` and served only through the access-checked
  `/listings/:id/image` routes — never from `Backend/public`.
- A category that still has listings (any status) or vendor assignments cannot be deleted;
  the API says what to move first. Deactivating it hides its listings instead.
- Category names are unique after normalization (Unicode NFKC, trimmed, whitespace
  collapsed, case-insensitive).

## Roles and vehicle inspections (migration `0005`)

- Each vendor login has a **role**: `Vendor / Client` (default; every existing account kept it)
  or `Inspector`. Staff change it on the vendor page; it takes effect on the next request.
  Both roles use the same portal URL; the layout follows the role. Inspectors cannot use
  catalog routes (API answers 403, the portal redirects to Inspections).
- **Checklist templates** (admin → Checklist templates, migration `0006`) describe one paper
  form per vehicle type (FORKLIFT, DOUBLE CAB HILUX, MEDIUM BUS, LARGE BUS): document header
  and logos, vehicle-detail fields with configurable defaults (Model, Mileage (KM), Date,
  Location, Div. / Project), the status legend (`/` Satisfactory, `x` Defect, `N/A` Not
  Applicable, `M` Missing), numbered sections → items → nested items, measurement fields with
  units (tyre tread depth MM / inflation PSI at Front R/L, Rear R/L; battery voltage),
  Remarks / Comments, Next Servicing, sign-off captions, and the damage-diagram page.
  Templates are **versioned**: staff edit a draft, preview it (form and A4 print), then
  publish; a published version is frozen (database trigger). New inspections use the latest
  published version and keep their own copy, so later versions never change them.
- **The client's checklists are imported automatically**, once, after migrations run
  (`Backend/mashoor/src/checklist/mashhorModChecklist.js`, transcribed from
  "MASHHOR - MOD CHECKLIST.pdf" pages 1–8; diagrams cropped from the scan in
  `Backend/mashoor/assets/checklist-diagrams`). The import is keyed and repeatable: it never
  duplicates templates and never overwrites a template staff have edited.
- **Inspector form:** every item needs a status before submitting — nothing is pre-selected and
  an unanswered item is never treated as satisfactory. Required vehicle details and the extent
  of damage are checked too. Remarks / actions sit beside each item; the Summary lists exactly
  the items that carry one. Damage markers are tapped onto the diagram and stored as fractions
  of the image size, so they stay in place at any screen or print size. Drafts can be saved and
  reopened at any time.
- **Print view** (Print view button on an inspection): A4, following the paper form — header,
  vehicle details, two-column checklist with the legend, remarks / next servicing, sign-off
  lines showing the recorded digital confirmations (name, time, revision — never an imitation
  signature), then the summary and the damage page with markers. `?revision=N` prints an
  earlier revision.
- **Inspections** are created by staff (admin → Inspections): company, an active Inspector of
  that company, a template, and at least one of vehicle plate / registration no. / MOD
  registration no.
- **Workflow:** assigned → in progress (draft) → *Pending client verification* (each submit
  is a new, immutable revision) → client either *Request Re-check* (reason required; goes
  back to the inspector) or *Submit to HOO Approval* → Head of Operation approves → Approved.
  Old revisions, their sign-offs and the full event history are kept.
- **Sign-offs** (Checked by, Agreed by, Approved by (HOO), Acknowledgement) are assigned per
  company to specific accounts (vendor page → Inspection sign-offs). Only the assigned
  account can confirm its stage, only on the current revision, once; the dialog asks the
  signer to type their own full name (case/spacing ignored) as confirmation — the API
  records the signed-in account ID, a name snapshot, time and revision. Typing someone
  else's name never signs for them. Approved by requires Checked by and Agreed by on the
  same revision.
- **Acknowledgement:** if a revision has any remark (an item remark, Remarks / Comments, damage
  notes or a damage-marker note), it waits for the account assigned to the Acknowledgement
  stage; otherwise the system records "Auto-acknowledged — no remarks." This never approves
  anything — HOO approval is always a separate confirmation.
  It is re-evaluated for every revision. Whether a pending acknowledgement blocks HOO
  approval is a per-company setting (off by default).
- Every inspection route checks the company and role on the server; other companies'
  inspections answer 404, and deactivated accounts lose access immediately.

## API (current)

Admin (`/api/mashoor/admin`, staff only unless noted)

- `POST /auth/login` (public), `POST /auth/logout` (public), `GET /auth/me`
- `GET /dashboard` — totals: vendors, active vendor accounts, categories, listings by status
- `GET /vendors` (incl. each company's login `accounts`), `POST /vendors` (name, registrationNo, status,
  optional `account: { name, username, password, confirmPassword }`), `GET /vendors/:id` (incl. categories),
  `PATCH /vendors/:id` (name, registrationNo, status)
- `PUT /vendors/:id/categories` (`{ categoryIds: [...] }`, replaces the whole set)
- `POST /vendors/:id/users` (name, username, password, confirmPassword)
- `PATCH /vendor-users/:id` (name, username, `active: false` to deactivate; `active: true` is refused — use reactivate)
- `POST /vendor-users/:id/reactivate` (password, confirmPassword) — reactivates with a new staff-set password
- `POST /vendor-users/:id/reset-password` (password, confirmPassword) — ends sessions, active state unchanged
- `GET /categories`, `POST /categories`, `PATCH /categories/:id` (name, description, active),
  `DELETE /categories/:id` (409 with an explanation while in use)
- `GET /listings?q=&categoryId=&status=&page=&limit=`, `POST /listings`, `GET /listings/:id`,
  `PATCH /listings/:id` (title, description, categoryId, price, status: `draft` | `published` | `archived`)
- `PUT /listings/:id/image` (multipart field `image`), `DELETE /listings/:id/image`, `GET /listings/:id/image`

Portal (`/api/mashoor/portal`, vendor only unless noted)

- `POST /auth/login` (public, `{ username, password }`), `POST /auth/logout` (public),
  `GET /auth/me`, `POST /auth/change-password` (`{ currentPassword, newPassword }`; optional, renews the session)
- Read-only: `GET /categories`,
  `GET /listings?q=&categoryId=&page=&limit=`, `GET /listings/:id`, `GET /listings/:id/image`

List endpoints return `{ ..., pagination: { page, limit, total, pages } }` (the Backend's
shared `modules/pagination.module.js` shape). `GET /api/mashoor/health` → `{ "ok": true }`.
