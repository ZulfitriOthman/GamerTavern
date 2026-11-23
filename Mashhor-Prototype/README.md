# Mashhor Inspection System — client-demo prototype

Two React + Vite apps for the **Mashhor Vehicle Inspection and Approval System**, focused on inspections only:

| App | Folder | URL (dev) | Who |
| --- | --- | --- | --- |
| Admin site | `admin/` | http://localhost:5301 · https://mashhor.nanashicollectibles.com | Mashhor staff (email sign-in) |
| Portal | `portal/` | http://localhost:5302 · https://portal-mashhor.nanashicollectibles.com | Inspectors, client verifiers, signatories (username sign-in) |

Both talk to the **existing** Backend service and its Mashoor module (`Backend/mashoor`, `/api/mashoor`) through
same-origin Vite proxies. The prototype has no backend logic of its own. Organisation scoping, roles,
assignment, status transitions, revision checks and sign-off rules are all enforced by the existing API, and
history protection is enforced by the database triggers in `Database/mashoor/migrations`.

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
`/socket.io` (WebSocket upgrades included) to the demo Backend, so the browser only talks to its own
hostname and no extra path rules are needed in Cloudflare. Both hostnames are in `allowedHosts`
(`config/vite-backend.js`) and in the demo origin lists (`config/demo-backend.dotenv`). Optional path rules,
only if you ever want Cloudflare to bypass Vite for the API: on each hostname, `/api/mashoor*` and
`/socket.io*` → `http://localhost:3012`, listed above the catch-all.

## Demo backend and data (isolated)

`npm run dev:api` starts the real `Backend/server.js` through its `DOTENV_FILE` hook with
`config/demo-backend.dotenv`, **instead of** `Backend/.env.dev`:

- Port **3012**. Port 3002 is the **live** Backend container (`Backend/compose.yaml`, production MySQL,
  serves nanashicollectibles.com); the demo never uses it. That container runs the same code, so it has the
  `/mashoor` namespace too, but its env and Mashoor database are unchanged.
- A separate SQLite database `Backend/mashoor/data/demo/mashhor-demo.db` and storage folder
  `Backend/mashoor/data/demo/storage`. Both are git-ignored.
- The marketplace's MySQL settings point at a closed local port, so the demo can never reach a real or live
  MySQL database. The Backend logs `[DB] ping failed` and the ticketing sweep warnings; the inspection API is
  unaffected.
- `MASHOOR_ALLOWED_ORIGINS` and `EXTRA_ORIGINS` (the Backend's Socket.IO polling CORS check) list the two
  local Vite origins and the two HTTPS hostnames. The existing `Listing-Sample/Mashoor` apps use the same
  ports, so they cannot run at the same time as the prototype.

`npm run demo:setup` does two things:

1. Creates the staff account with the Backend's **terminal-only** `npm run mashoor:create-staff`.
2. Runs `npm run mashoor:seed-demo` (`Backend/mashoor/scripts/seed-demo.js`). This creates fictional
   organisations, accounts, sign-off assignments and inspections through the real API.

The seed refuses `NODE_ENV=production`, the default database, and any file name without "demo".
`npm run demo:reset` deletes only the demo database and storage, then sets them up again.

No schema change was needed. The checkout uses SQLite through `node:sqlite` with migrations 0001–0006, as the
handover describes. The demo database is at `user_version` 6.

## Accounts (all fictional)

The staff account is `staff@mashhor-demo.test` / `Demo-Staff-2026!`. Every portal account uses the password
`Demo-Pass-2026!`. Signatories confirm by typing the full name shown below.

| Organisation | Username | Full name | Role | Sign-off stage |
| --- | --- | --- | --- | --- |
| Demo Fleet Contract A (approval **not** blocked by acknowledgement) | `a.inspector` | Adam Inspector | Inspector | — |
| | `a.inspector2` | Aisyah Inspector | Inspector | — |
| | `a.client` | Clara Client | Vendor / Client | — |
| | `a.checker` | Chong Checker | Inspector | Checked by (MGCSB, Inspector) |
| | `a.agreer` | Aminah Agreer | Vendor / Client | Agreed by (MINDEF) |
| | `a.hoo` | Harun Operations Head | Inspector | Approved by (Head of Operations) |
| | `a.ack` | Aziz Acknowledger | Vendor / Client | Acknowledgement |
| Demo Fleet Contract B (approval **blocked** until acknowledged) | `b.inspector`, `b.client`, `b.checker`, `b.agreer`, `b.hoo`, `b.ack` | Bakar Inspector, Bella Client, Ben Checker, Bunga Agreer, Badrul Operations Head, Batrisya Acknowledger | same pattern | same pattern |

The seeded inspections are:

| Inspection | Organisation and vehicle | State |
| --- | --- | --- |
| A1 | A, Forklift DEMO 1001 | Assigned |
| A2 | A, Medium Bus DEMO 2002 | Draft |
| A3 | A, Large Bus DEMO 3003 | Pending verification; no remarks, so auto-acknowledged |
| A4 | A, Double Cab DEMO 4004 | Approved with acknowledgement still pending (handover C4) |
| B1 | B, Double Cab DEMO 6006 | Pending approval; the HOO is blocked because the damage-marker note needs acknowledgement |
| B2 | B, Forklift DEMO 7007 | Assigned |

## Run it (Windows, from the repository root)

```powershell
cd D:\Github\GamerTavern\Mashhor-Prototype
npm install
npm run install:all
npm run demo:reset      # or demo:setup the first time; stop `npm run dev` before resetting
npm run dev             # API :3012 + admin :5301 + portal :5302 (development)
```

For the client demo, serve the production builds instead (stop `npm run dev` first):

```powershell
npm run build
npm run preview         # API :3012 + built admin :5301 + built portal :5302
```

Use one browser profile for the admin site and a **private window** (or another browser) for the portal, so
you can switch portal accounts without losing the staff session.

## Walkthrough

1. **Admin** (http://localhost:5301): sign in as staff.
   1. Go to **Vendors → Demo Fleet Contract A** to show the portal accounts and the **Inspection sign-offs**
      card, which holds the stages and the acknowledgement-blocking option.
   2. Go to **Checklist templates** and open the Double Cab to preview the form and the A4 print.
   3. Go to **Inspections → New inspection**. Choose Demo Fleet Contract A, Adam Inspector and Double Cab
      (Hilux), and enter plate `DEMO 5005`.
   4. On the inspection, correct a field or reassign the inspector. This is allowed while the checklist is with
      the inspector.
2. **Portal** (http://localhost:5302): sign in as `a.inspector` and open DEMO 5005. No mark is pre-selected.
   1. Mark a few items and click **Save draft**.
   2. Click **Submit**. The submission is refused and lists the unanswered items.
   3. Mark every item and add a remark on one item. Enter tyre measurements, tap the diagram to place a damage
      marker with a note, and choose an extent of damage. Then **Submit** to create revision 1.
3. Sign in as `a.client`. Open the inspection and choose **Request Re-check** with a reason.
4. Sign in as `a.inspector`. The re-check reason is shown. Remove the remarks and **Resubmit** to create
   revision 2, which is auto-acknowledged.
5. Sign in as `a.client` and choose **Submit to HOO Approval**.
6. Sign in as `a.checker`, then `a.agreer`. Each one **Confirms** by typing their full name; the order does
   not matter.
7. Sign in as `a.hoo` and confirm **Approved by** to approve the inspection.
8. Print: on the admin inspection page, click **Print view** and choose **Revision 1 (superseded)** in the
   picker. It shows the SUPERSEDED banner, revision 1's own checklist and confirmations, and a
   submission-record sheet with its re-check reason and history. Press Ctrl+P for the A4 preview.

Other things to show:

- Organisation B: as `b.hoo`, approving B1 is refused until `b.ack` acknowledges. In organisation A, A4 was
  approved while its acknowledgement was still pending.
- Stale revision: open an inspection pending verification as `a.client`. Return and resubmit it in another
  session, then forward it from the first page. The action is refused with **Reload inspection**.
- Isolation: `b.client` cannot open organisation A inspections; the API answers 404.

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Demo API and both dev servers |
| `npm run build` | Production builds in `admin/dist` and `portal/dist` |
| `npm run preview` | Demo API and the built apps on the same ports |
| `npm run lint` | oxlint over the prototype sources |
| `npm test` | The Mashhor backend tests, including `realtime.test.js` (`Backend: npm run mashoor:test`) |
| `npm run demo:setup` / `demo:reset` | Create, or recreate, the isolated demo data |

## Limitations still visible in the demo

- Screens say "Vendor" and "Vendor / Client" for client organisations, which is the system's current wording
  (C7). The brand mark still reads "Mashoor".
- All signatories, including the Head of Operations, are portal accounts of the inspection's own organisation
  (C1). Any client account can verify (C2).
- There is no cancel or delete for inspections (C5), no notifications (C9), no reports or exports (C10) and no
  vehicle register (C14). Staff accounts can only be created from the terminal (C6).
- Times are stored in UTC and shown in the viewer's local time.
- The Backend console shows marketplace MySQL errors because the demo deliberately runs without MySQL.
