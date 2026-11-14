# Mashoor database (SQLite) — NOT part of the GamerTavern MySQL schema

These migrations belong to the **Mashoor catalog-sharing module**
(`Backend/mashoor`, frontends in `Listing-Sample/Mashoor`). They target
Mashoor's own **SQLite** database (`Backend/mashoor/data/mashoor.db` by default,
Node's built-in `node:sqlite`), not the shared MySQL database described in
`../README.md`.

**Never `SOURCE` these files into MySQL.** They use SQLite syntax and Mashoor
tables, and the MySQL instance is shared with unrelated applications.

## How they are applied

Automatically. When the Backend starts (or any `npm run mashoor:*` script opens
the database), `Backend/mashoor/src/migrations.js` reads
`migrations/NNNN_description.sql` in filename order and applies every file whose
number is greater than the database's `PRAGMA user_version`, each in its own
transaction, then sets `user_version` to that number. There is nothing to run by
hand.

- Append new files with the next number; never edit or renumber a file that has
  shipped. Numbers must be contiguous from `0001`.
- The Backend refuses to load the module (and logs why) if the database is newer
  than the files it can see, or if this folder is missing. In Docker,
  `Backend/compose.yaml` mounts this folder read-only.
- Take a copy first for anything that is not purely additive, e.g. with
  `VACUUM INTO` into `Backend/mashoor/data/backups/` (gitignored).

| File | Summary |
|---|---|
| `0001_initial_schema.sql` | Staff/vendor accounts, vendor companies, catalogs, sessions, audit log |
| `0002_add_categories_and_listings.sql` | Categories, company↔category access, listing fields (category, price, image), first-login password change |
| `0003_vendor_username_login.sql` | Vendors sign in with a username; email optional. Rebuilds `vendor_users` keeping every row/id; pre-existing accounts get no username until staff set one |
| `0004_optional_vendor_password_change.sql` | Clears `must_change_password` on all vendor accounts; password changes are voluntary from now on (column kept, unused) |
| `0005_inspector_role_and_vehicle_inspections.sql` | Account role (client/inspector, default client), checklist templates, per-company signatories, inspections with immutable revisions, sign-offs and events |
| `0006_checklist_form_templates.sql` | Versioned checklist form templates (JSON definitions, draft → published, published versions frozen), damage diagrams, form definition + answers on inspections; triggers keep submitted revisions, sign-offs and inspection history immutable. The client's four MOD checklist forms are imported after migrating by `Backend/mashoor/src/checklist/seed.js` (keyed, repeatable) |
