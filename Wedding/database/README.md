# Wedding Database (MySQL / MariaDB)

These SQL scripts create everything the wedding website stores. **Nothing is created automatically:** the API never creates or alters tables on startup. You run these scripts yourself in MySQL Workbench.

- **Engine:** MySQL 5.7+ / MariaDB 10.3+. Verified on **MariaDB 10.6.28**, the same version as the live GamerTavern server, and on **MySQL 8.0.46**.
- **Conventions:** these match [`Database/README.md`](../../Database/README.md): InnoDB, `utf8mb4_unicode_ci`, no `CHECK` constraints (the rules are enforced in API code and noted in each file's header), and JSON stored as `LONGTEXT`.
- **Table names:** every table is prefixed **`wedding_`**. This matters because the shared GamerTavern database already has an unrelated `events` table, plus WordPress and barbershop tables. These scripts only ever touch `wedding_*` tables.
- **Safe to re-run:** scripts use only `CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE` and guarded inserts. There are no `DROP`, `TRUNCATE` or `DELETE` statements.

## Folder structure

```
database/
├── README.md                         — this file
├── migrations/                       — schema, run once each, in order
│   ├── 000_create_wedding_schema_migrations.sql  — records which scripts have run
│   ├── 001_create_wedding_settings.sql           — site settings + editable content
│   ├── 002_create_wedding_events.sql             — Majlis / ceremonies
│   ├── 003_create_wedding_guests.sql             — invited households, hashed RSVP links
│   ├── 004_create_wedding_rsvps.sql              — replies (FK → events, guests)
│   ├── 005_create_wedding_greetings.sql          — guestbook wishes
│   ├── 006_create_wedding_albums.sql             — photo albums
│   ├── 007_create_wedding_photos.sql             — photo metadata (FK → albums)
│   ├── 008_create_wedding_admins.sql             — admins + sessions
│   ├── 009_create_wedding_rate_limits.sql        — anti-spam rate limiting
│   └── 010_add_media_type_to_wedding_photos.sql  — GIF & video support (adds 2 columns; re-runnable)
├── seeds/
│   └── 001_wedding_information.sql   — official invitation details, the event, default albums
├── queries/
│   ├── verification.sql              — read-only checks to run afterwards
│   ├── publish_existing_pending_guest_photos.sql — OPTIONAL, review first: publish photos left pending by the old approval workflow
│   └── record_applied_migrations.sql — only if the tables exist but wedding_schema_migrations is empty
└── archive/
    └── supabase-legacy/              — the previous Supabase version, kept for reference only
```

The files are numbered in foreign-key order: events and guests come before RSVPs, albums before photos, admins before sessions.

## 1. Choose where the tables live

Pick one option:

- **Recommended: a separate database**, e.g. `nanashi_wedding`, created in cPanel → *MySQL Databases*. Then create a MySQL user with privileges on that database **only**, and put it in `Wedding/server/.env`. A bug or leak in the wedding site then cannot reach marketplace data.
- **Alternatively, the existing database.** Every table is prefixed `wedding_`, so nothing collides with existing tables. Still use a separate MySQL user if your host lets you grant per-table privileges.

On a local MySQL you can create the database yourself:

```sql
CREATE DATABASE wedding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Run the scripts in MySQL Workbench

1. Open MySQL Workbench and connect to the server.
2. In the **Schemas** panel, right-click your wedding database and choose **Set as Default Schema** (it turns bold). The scripts don't contain `USE`, so they run in whichever schema is the default.
3. For **each** file in `migrations/`, in order `000` → `010`:
   1. Choose **File → Open SQL Script…** and pick the file.
   2. Click the **lightning bolt** (Execute the selected portion or everything; shortcut Ctrl+Shift+Enter).
   3. Check the **Output** panel at the bottom: every row should have a green tick.
4. Open and execute **`seeds/001_wedding_information.sql`**.
5. Open and execute **`queries/verification.sql`**, then check:
   - `wedding_schema_migrations` lists `000` to `009`;
   - there are 11 `wedding_*` tables, all InnoDB / `utf8mb4_unicode_ci`;
   - there are 4 foreign keys;
   - the settings row shows `2027-01-01`, `13:30:00`, `Asia/Brunei`;
   - one event, "Majlis Bersanding", is listed;
   - 4 albums exist, with exactly one guest-upload album.

> **Make sure auto-commit is ON** (the toolbar icon with the green tick, or *Query → Auto-Commit Transactions*). With it off, `CREATE TABLE` still commits but the `INSERT`s at the end of each migration are rolled back when the tab closes. The tables exist, but `wedding_schema_migrations` stays empty. If that happened, run `queries/record_applied_migrations.sql` once. The API's `/api/health` shows `"migrationsRecorded": false` in this case.

> If Workbench shows Arabic text as `????`, the connection isn't using utf8mb4. Edit the connection → *Advanced* → *Others* and add `characterEncoding=utf8mb4`, or check that the database was created with `utf8mb4`. The API connects with `utf8mb4` regardless.

Using the command line instead:

```bash
mysql -h HOST -u USER -p DATABASE < database/migrations/000_create_wedding_schema_migrations.sql
# … repeat for 001–009, then:
mysql -h HOST -u USER -p DATABASE < database/seeds/001_wedding_information.sql
```

## 3. Create the first administrator

There is no public sign-up page and no default password. Configure `Wedding/server/.env` (see the main README), then run:

```bash
cd Wedding/server
npm run create-admin -- --email you@example.com --name "Zulfitri"
```

You'll be asked to type the password twice. It is hidden, must be at least 12 characters, and is stored only as a bcrypt hash. To change a password later, add `--reset`, which also signs out every existing session for that admin.

## What the seed contains

All of it comes from the official invitation, *Undangan perkahwinann 2027*.

| Item | Value |
| --- | --- |
| Display names | Zulfitri & Mariah (monogram **ZM**) |
| Full names | Awang Muhammad Zulfitri Bin Othman · Dayang Siti Mariah Binti Abdullah @ Md Yusof |
| Date | Jumaat, 01 Januari 2027 · 22 Rejab 1448 · countdown to 1:30 PM, Asia/Brunei |
| Event | Majlis Bersanding at Masjid Suri Seri Begawan Raja Pengiran Anak Damit, Kampung Madang, Brunei Darussalam |
| Programme | 1:30–2:15 PM Menerima Jemputan · 2:30 PM Majlis Menghantar Berian Dan Mas Kahwin · then Majlis Akad Nikah, Bersanding, Membaca Doa Selamat, Menikmati Jamuan, with **no times, as on the invitation** |
| Wording | Bismillah, Assalamualaikum, invitation paragraph, "Yang Mulia" salutation, name-apology note, closing appreciation, "Yang Berharap" and the family list, all reproduced from the card |

**Deliberately left empty** because the invitation doesn't state them. Empty fields are hidden from guests, and you can fill them in later in the dashboard:

- the story, the timeline and the couple/hero photos ("Our Story" stays switched off until written);
- dress code, FAQ, contact people, gift details and travel notes;
- the RSVP deadline, the event capacity and the majlis end time.

The default **4 guests per reply** is a configurable limit, not information from the invitation. Adjust it in *Events*; each invited household's own seat limit also applies.

Re-running the seed never overwrites changes you've made: the settings row is kept if it exists, the event is only inserted if missing, and albums are matched on their slug.

## Future schema changes

Never edit a migration that has already been run. Add a new numbered file instead, e.g. `migrations/010_add_dietary_notes_to_rsvps.sql`:

```sql
-- 010 · Add dietary notes to RSVPs
ALTER TABLE wedding_rsvps ADD COLUMN dietary_notes VARCHAR(300) NULL AFTER message;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('010', 'Add dietary_notes to wedding_rsvps');
```

Then bump `REQUIRED_MIGRATION` in `server/src/db.js`, so the API warns at startup if the script hasn't been run yet. Before running anything containing `DROP`, `DELETE` or `ALTER … DROP`, back up the wedding tables (see below).

## Backups

Back up **both** the tables and the uploaded photo files.

```bash
# Wedding tables only (never dump the whole shared database):
mysqldump -h HOST -u USER -p DATABASE \
  wedding_schema_migrations wedding_settings wedding_events wedding_guests wedding_rsvps \
  wedding_greetings wedding_albums wedding_photos wedding_admins wedding_admin_sessions wedding_rate_limits \
  > wedding_backup_$(date +%Y%m%d).sql

# Photo files (UPLOAD_DIRECTORY, default Wedding/server/uploads):
tar czf wedding_uploads_$(date +%Y%m%d).tgz -C Wedding/server uploads
```

In Workbench: **Server → Data Export**, pick the database, tick only the `wedding_*` tables, and choose *Export to Self-Contained File*.

## Photo storage

- Image files are **not** stored in MySQL. The database stores only relative keys such as `photos/2027-01/<uuid>.jpg`, and the API resolves them inside `UPLOAD_DIRECTORY`.
- Files are re-encoded by the server, which strips metadata such as GPS and produces a thumbnail. They get random UUID names, and the API refuses any key outside that directory.
- `UPLOAD_DIRECTORY` **must be persistent disk**: cPanel home directory, VPS or similar. Serverless or ephemeral hosts (Vercel/Netlify functions, some containers) delete files on redeploy. To use object storage instead, replace the four functions in `server/src/lib/storage.js`.
- `UPLOAD_QUOTA_MB` (default 5000) caps total photo storage. Guests are told politely when it's full.

## Supabase → MySQL mapping

The previous version used Supabase. Its files are kept in `archive/supabase-legacy/` for reference only. Nothing reads them, and they can be deleted once you're satisfied. Every rule was carried over:

| Supabase (archived) | MySQL version |
| --- | --- |
| Postgres tables + `CHECK` constraints | `migrations/001–009` + validation in `server/src/lib/validate.js` / services |
| RLS: guests read only published/approved rows | Public API returns only published events, public albums, approved wishes and photos |
| RLS: admin-only tables (`is_admin()`) | `requireAdmin` middleware on every `/api/admin/*` route (session + CSRF) |
| `submit_greeting` / `submit_rsvp` / `get_invitation` RPCs | `services/greetings.js`, `services/rsvp.js`: same validation, dedupe, capacity locking (`SELECT … FOR UPDATE`) and deadline rules |
| Plain-text invite tokens | **Improved:** only SHA-256 hashes are stored; links are shown once |
| Postgres rate-limit table | `wedding_rate_limits` (salted IP/email hashes) |
| Supabase Auth + `admin_profiles` | `wedding_admins` (bcrypt) + `wedding_admin_sessions` (HttpOnly cookie, hashed token, CSRF token) |
| Storage buckets + storage RLS | Files on disk via the API; pending photos return 404 to guests |
| `guest-upload` Edge Function | `POST /api/public/photos`: magic-byte check, sharp re-encode, thumbnail, quota, rate limit |
