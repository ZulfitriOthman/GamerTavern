# Mashhor Inspection System — client-demo prototype

Two React + Vite apps for the **Mashhor Vehicle Inspection and Approval System**, focused on inspections only:

| App | Folder | URL (dev) | Who |
| --- | --- | --- | --- |
| Admin site | `admin/` | http://localhost:5301 · https://mashhor.nanashicollectibles.com | Mashhor staff (email sign-in) |
| Portal | `portal/` | http://localhost:5302 · https://portal-mashhor.nanashicollectibles.com | Inspectors, client verifiers, signatories (username sign-in) |

Both talk to the **existing** Backend service and its Mashoor module (`Backend/mashoor`, `/api/mashoor`) through
same-origin Vite proxies. The prototype has no backend logic of its own. Organisation scoping, roles,
assignment, status transitions, revision checks and sign-off rules are all enforced by the existing API, and
history protection is enforced by the database triggers (`Database/mashoor/mysql/migrations`, 0006 and 0008).

## What is reused

- `Listing-Sample/Mashoor/packages/shared` (alias `@mashoor/shared/*`): API client, auth, login, checklist
  form, damage diagram, sign-off panel, A4 print layout, styles.
- These existing admin pages are used unchanged (alias `@legacy-admin/*`): the inspection list (status filters
  and the create form), inspection detail (reassign/correct, history, revision links), checklist templates and
  the template editor (preview, publish), the inspection sign-off settings and the account fields.
- These existing portal pages are used unchanged (alias `@legacy-portal/*`): the role-based work lists and the
  password change in Settings.
- New in the prototype:
  - `admin/src/pages/Vendor*.jsx`: the organisation pages without the catalog category-access parts.
  - `portal/src/pages/InspectionPage.jsx`: the existing page plus a **Reload** prompt when the API refuses an
    action against a stale revision.
  - `admin/src/pages/Inspections*.jsx`, `InspectionDetailPage.jsx` and `portal/src/pages/InspectionsPage.jsx`:
    copies of the existing pages that also refetch on live updates.
  - `shared/src/live.jsx`, `useLive.js`: live updates over Socket.IO (see below).
  - `shared/src/InspectionPrintPage.jsx` and `RevisionRecord.jsx`: a revision picker, a "superseded" banner
    and a printed **submission-record sheet** with that revision's own client decision, confirmations and
    history.

The catalog (categories and listings) is not in the prototype's navigation. The existing apps in
`Listing-Sample/Mashoor` are unchanged.

## Live updates (Socket.IO)

Lists, queue counts, inspection pages and sign-off panels update without a manual refresh.

- Backend: `Backend/mashoor/src/realtime.js`, attached in `Backend/server.js` to the Backend's **existing**
  Socket.IO server. **Namespace `/mashoor`**, **transport path `/socket.io`** (the server's default path; the
  namespace is not a URL path). Notify-only: after a write has committed, authorised sockets get
  `inspection:changed` `{ inspectionId, action, status, self }` and refetch through the REST API.
  Actions: `created`, `updated` (correction / reassignment), `saved`, `submitted`, `returned` (re-check),
  `verified`, `signed`, `approved`. `access:changed` follows staff changes to an organisation's accounts or
  sign-off stages.
- Authentication: the session cookies are path-scoped to `/api/mashoor/admin` and `/api/mashoor/portal`, so
  they never reach `/socket.io`. The app calls `POST /api/mashoor/{admin|portal}/realtime/ticket`
  (cookie + Origin checked) for a **single-use, 30-second ticket** and sends it in the handshake. The socket
  stays bound to that session and is re-checked before every delivery and every 30 s: logout, expiry,
  password change, deactivation or suspension disconnects it.
- Recipients are resolved on the server: staff sockets, and portal sockets of the inspection's organisation
  that pass the REST visibility rule (client; assigned inspector, before or after a reassignment; sign-off
  account). Another organisation receives nothing. A handshake `Origin` must be in `MASHOOR_ALLOWED_ORIGINS`.
- Frontend: `LiveProvider` connects after sign-in and disconnects on sign-out; it refetches after a
  reconnect. An inspector with unsaved edits is shown a **Reload** notice instead of losing their work.
  The sidebar / header shows **Live**, **Connecting** or **Offline**.

## Public hostnames (Cloudflare tunnel)

The existing remotely-managed Cloudflare tunnel (Windows service `Cloudflared`) already routes:

| Hostname | Origin service |
| --- | --- |
| `mashhor.nanashicollectibles.com` | `http://localhost:5301` (admin) |
| `portal-mashhor.nanashicollectibles.com` | `http://localhost:5302` (portal) |

The Vite dev or preview server on each port serves the app (SPA fallback) and proxies `/api/mashoor` and
`/socket.io` (WebSocket upgrades included) to the Backend, so the browser only talks to its own hostname.
Both hostnames are in `allowedHosts` (`config/vite-backend.js`).

Vite listens on `127.0.0.1` only (`LISTEN_HOST` in `config/vite-backend.js`), so the tunnel can target
`http://127.0.0.1:5301` / `:5302` (or `localhost`). The tunnel is dashboard-managed; its live ingress (read from
cloudflared's local `/config`, version 33 on 2026-11-23) maps the two hostnames to `http://localhost:5301` and
`http://localhost:5302`, which also works.

The Backend allows both HTTPS origins: `MASHOOR_ALLOWED_ORIGINS` in `Backend/compose.yaml` (sign-in, writes and
the `/mashoor` socket namespace), and `Backend/server.js` accepts exactly those origins for the Socket.IO
transport too (the marketplace HTTP CORS list is not widened).

## Backend and database

- **Backend:** the existing Backend service in Docker (`Backend/compose.yaml`, container `backend-backend-1`),
  published on `127.0.0.1:3002`. Both Vite proxies target `http://127.0.0.1:3002` (IPv4 on purpose: the port is
  published on IPv4 only, and `localhost` may resolve to `::1` first, which gives `ECONNREFUSED`). Override with
  `API_URL`.
- **Database:** MySQL / MariaDB. The Mashoor module uses its own mysql2 pool with the Backend's established pool
  settings; `MASHOOR_MYSQL_*` in `Backend/.env.dev`, falling back to `MYSQL_*`. Verified 2026-11-23 from inside
  the container: `SELECT DATABASE(), VERSION()` → `nanashi_collectibles`, `10.6.28-MariaDB` on
  `s1319.sgp1.mysecurecloudhost.com:3306` — **the same database the live marketplace uses**. Tables are
  `mashoor_*`; schema version 9 (`Database/mashoor/mysql/migrations`; 0009 adds organisation removal).
- **No fallback:** if MySQL is unreachable, not configured, or the schema is not at version 9, `/api/mashoor`
  does not start and the Backend log says why (host and database name, never credentials). The marketplace keeps
  running. The old SQLite file `Backend/mashoor/data/mashoor.db` is kept but no longer read.
- **Migrations are never applied automatically.** From `Backend/`: `npm run mashoor:migrate` shows the status;
  `-- --apply` applies pending files.
- **Tests** use a disposable local MariaDB 10.6.28 (`mashoor-mysql-test`, `127.0.0.1:3310`), one throwaway
  `mashoor_test_*` database per test file (`Backend/.env.test`, git-ignored). They never touch the Backend's
  database.

## Accounts (fictional, in the live database)

Created 2026-11-23 with your approval. Passwords are in `Mashhor-Prototype/demo-credentials.local` (git-ignored).

| Where | Sign-in | Who |
| --- | --- | --- |
| Admin | `staff@mashhor-demo.test` | Demo Staff (created with the terminal-only `mashoor:create-staff`) |
| Portal | `a.inspector` | Adam Inspector, Inspector of **Demo Fleet Contract A** (`DEMO-ORG-A`) |

Also imported at Backend start-up: the 4 bundled checklist templates (Forklift, Double Cab Hilux, Medium Bus,
Large Bus) and their damage diagrams. Test inspection: **id 1**, vehicle plate `QA-MSH-20261123-0942`.

`npm run mashoor:seed-dev` / `mashoor:seed-demo` (in `Backend/`) refuse to run unless the target database is
confirmed by name (`MASHOOR_SEED_DEV_DATABASE` / `MASHOOR_DEMO_DATABASE`). Do not run them against
`nanashi_collectibles` without approval.

## Run it (Windows PowerShell)

The Backend container must be running (`docker ps` shows `backend-backend-1` on `127.0.0.1:3002`).

```powershell
cd D:\Github\GamerTavern\Mashhor-Prototype
npm install; npm run install:all     # once
npm run dev                          # admin :5301 + portal :5302 (Vite dev, proxies to :3002)
# or, production builds:
npm run build; npm run preview
```

Then open http://localhost:5301 (staff) and, in a private window, http://localhost:5302 (portal).

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Both dev servers (the Backend runs in Docker) |
| `npm run build` | Production builds in `admin/dist` and `portal/dist` |
| `npm run preview` | The built apps on the same ports and proxies |
| `npm run lint` | oxlint over the prototype sources |
| `npm test` | Backend `npm run mashoor:test` (needs the `mashoor-mysql-test` container) |

## Limitations still visible in the demo

- Screens say "Vendor" and "Vendor / Client" for client organisations, which is the system's current wording
  (C7). The brand mark still reads "Mashoor".
- All signatories, including the Head of Operations, are portal accounts of the inspection's own organisation
  (C1). Any client account can verify (C2).
- There is no cancel or delete for inspections (C5), no notifications (C9), no reports or exports (C10) and no
  vehicle register (C14). Staff accounts can only be created from the terminal (C6).
- Times are stored in UTC and shown in the viewer's local time.
- Staff sign in by email; the `username` column for staff (migration 0007) is not used by the backend yet.
