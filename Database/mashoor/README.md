# Mashoor database — MySQL / MariaDB

The **Mashoor catalog-sharing module** (`Backend/mashoor`, frontends in
`Listing-Sample/Mashoor`) keeps its data in MySQL / MariaDB. All of its tables
are prefixed **`mashoor_`**, so they can live in the Backend's own database
(the default) or in a database of their own.

Confirmed target server: **10.6.28-MariaDB** (`SELECT VERSION()` on the
Backend's configured server). The SQL also runs on MySQL 8.0.16+.

```
Database/mashoor/
├── mysql/
│   ├── mashoor_mysql_schema.sql   ← fresh install: run this in MySQL Workbench
│   └── migrations/                ← MySQL migration path (applied by the backend)
│       ├── 0001_initial_schema.sql … 0007_staff_username_login.sql
└── migrations/                    ← HISTORICAL SQLite migrations — do NOT run in MySQL
```

## Which file do I run?

| Situation | Run |
|---|---|
| New, empty MySQL database (no `mashoor_` tables) | `mysql/mashoor_mysql_schema.sql` once. It equals `mysql/migrations/0001…0007` applied in order (checked by a test). The backend never creates the tables in an empty database by itself unless `MASHOOR_MYSQL_AUTO_INSTALL=true` (tests / local development only). |
| Moving the existing SQLite data to MySQL | 1. `mysql/mashoor_mysql_schema.sql` 2. the generated import file (see below) 3. start the backend. In that order — start the backend only after the import. |
| MySQL database that already has some `mashoor_` migrations | Nothing by hand: the backend applies the missing `mysql/migrations` files in order at start-up. (Or run exactly the missing files in Workbench, in order — each records itself.) |

In MySQL Workbench: double-click the target schema to make it the default,
open the file, and run the **whole script** (lightning-bolt icon). The files
use `DELIMITER` around trigger bodies, which Workbench supports.

## Migration tracking

`mashoor_schema_migrations (version, name, applied_at)` records every applied
MySQL migration (it replaces SQLite's `PRAGMA user_version`). Each migration
file ends by inserting its own row, so a file run by hand in Workbench counts
as applied. At start-up the backend takes a named lock (`GET_LOCK`), applies
only the files without a row, and refuses to start if the history has gaps or
names a file it does not have. Restarting never re-applies anything.

- Append new files with the next number; never edit or renumber a file that
  has shipped. MySQL commits DDL immediately, so a migration that fails half
  way is not rolled back — the error names the file and statement.
- `Backend/compose.yaml` mounts `Database/mashoor` read-only into the container.

| MySQL migration | Summary (mirrors the SQLite migration of the same number) |
|---|---|
| `0001_initial_schema.sql` | Migration history table; staff/vendor accounts, vendor companies, catalogs, sessions, audit log |
| `0002_add_categories_and_listings.sql` | Categories, company↔category access, listing fields (category, price, image) |
| `0003_vendor_username_login.sql` | Vendor username login (unique case-insensitively, stored lower-case); email optional |
| `0004_optional_vendor_password_change.sql` | Clears `must_change_password` (column kept, unused) |
| `0005_inspector_role_and_vehicle_inspections.sql` | Account role, checklist templates, signatories, inspections, revisions, sign-offs, events |
| `0006_checklist_form_templates.sql` | Versioned form templates (one draft per template), damage diagrams, form copy + answers on inspections; triggers freeze published versions, submitted revisions, sign-offs and history; history foreign keys become RESTRICT |
| `0007_staff_username_login.sql` | MySQL only (no SQLite counterpart): admin accounts get a username (unique case-insensitively, stored lower-case); email becomes optional; each account keeps at least one of the two |

## Creating an admin account from the terminal

From `Backend/` (PowerShell or any shell):

```
npm run mashoor:create-staff -- --username <username> --name "<display name>" [--email <email>]
```

The password is asked for twice with hidden input (never an argument or an
environment variable). The account is created active with role admin and
signs in on the Admin website with the username (or the email, if given).
An existing username or email is refused and nothing is changed.

## SQLite → MySQL conversion notes

| SQLite | MySQL / MariaDB |
|---|---|
| `INTEGER PRIMARY KEY` | `INT UNSIGNED NOT NULL AUTO_INCREMENT` (foreign keys use the same type) |
| `TEXT … COLLATE NOCASE` (staff email) | `VARCHAR(254)` in `utf8mb4_unicode_ci` (case-insensitive unique) |
| username `UNIQUE` + lower-case `CHECK` | `VARCHAR(40)` `utf8mb4_unicode_ci` unique (case-insensitive) + byte-wise lower-case/trimmed `CHECK` |
| `TEXT` timestamps, `DEFAULT CURRENT_TIMESTAMP` (UTC) | `DATETIME DEFAULT CURRENT_TIMESTAMP`; every backend connection uses `time_zone = '+00:00'` and reads them back as the same `YYYY-MM-DD HH:MM:SS` text |
| `sessions.created_at / expires_at` (epoch ms) | `BIGINT` epoch ms (unchanged units); `token_hash` = SHA-256 hex in `CHAR(64)` ascii_bin |
| JSON in `TEXT` | `TEXT` / `MEDIUMTEXT` in `utf8mb4_bin` (stored and compared exactly) |
| partial unique index (`WHERE state = 'draft'`, `WHERE seed_key IS NOT NULL`) | unique index on a generated column / plain unique (NULLs never collide) |
| `RAISE(ABORT, …)` triggers, `BEFORE UPDATE OF col` | `SIGNAL SQLSTATE '45000'` triggers comparing `OLD`/`NEW` columns |
| `ON DELETE CASCADE` into history tables | `ON DELETE RESTRICT` (MySQL runs no triggers for cascaded deletes) |
| `PRAGMA user_version` | `mashoor_schema_migrations` |

All tables: InnoDB, `utf8mb4` / `utf8mb4_unicode_ci`, explicit named foreign keys.

## Moving existing SQLite data (one time)

From `Backend/` (host, Node 24+):

```
node mashoor/scripts/sqlite-to-mysql.js --sqlite mashoor/data/mashoor.db
```

It first writes a consistent backup, `mashoor/data/backups/mashoor_before_mysql_<time>.db`
(SQLite backup API; the original is opened read-only), then writes
`mashoor/data/backups/mashoor_mysql_import_<time>.sql` for Workbench. That
script inserts every row with its original id in one transaction, refuses to
run if any `mashoor_` table already holds data, and ends with a row-count check
(`rows_now` = `rows_expected`). Sessions are not copied (everyone signs in once
more). It contains password hashes — delete it after the import. Uploaded
images stay where they are (`MASHOOR_STORAGE_DIR`, default `Backend/mashoor/storage`).

The historical SQLite migrations in `migrations/` stay unchanged as the record
of what the SQLite database went through; the backend no longer reads them.
