# Zulfitri & Mariah — Wedding Website

The invitation website for the **Majlis Bersanding of Awang Muhammad Zulfitri Bin Othman & Dayang Siti Mariah Binti Abdullah @ Md Yusof**, held on Jumaat, 1 Januari 2027 (22 Rejab 1448) at Masjid Suri Seri Begawan Raja Pengiran Anak Damit, Kampung Madang.

Guests get:
- an envelope-style invitation with the ZM monogram;
- a countdown;
- the event programme with directions and calendar links;
- a gallery;
- photo, GIF and video sharing (published to the gallery instantly);
- a guestbook;
- RSVP, including private per-household links.

The couple manage everything from a protected dashboard at `/admin`.

```
React (Vite) ──fetch──▶ https://backend.nanashicollectibles.com/api/wedding/*  ──▶  MySQL / MariaDB (wedding_* tables)
              (wedding module mounted inside the GamerTavern Backend)
                                         └──▶  photo files on disk (UPLOAD_DIRECTORY)
```

The browser never talks to MySQL and holds no secrets.

## Project structure

```
Wedding/
├── src/                     React frontend (pages, admin dashboard, components, services)
│   ├── lib/api.js           the only place that calls the API
│   ├── services/            data access per feature (content, RSVP, greetings, photos, admin)
│   └── config/defaultContent.js   content model + fallback values (confirmed invitation details)
├── server/                  Wedding API (separate from GamerTavern's Backend/)
│   ├── src/routes/          public, auth, admin and media endpoints
│   ├── src/services/        RSVP, greetings, photos, admin, auth, rate limiting
│   ├── src/lib/             validation, images (sharp), storage, crypto
│   ├── scripts/create-admin.js
│   └── tests/api.test.js    integration tests against a real MySQL
├── database/                manual SQL scripts for MySQL Workbench (see database/README.md)
└── tests/lib.test.js        frontend unit tests
```

### Why a separate `server/` instead of `Backend/`

`Backend/` is the live NanashiCollectibles process. Adding the wedding to it would have meant several risky changes:
- editing its shared `server.js`, CORS allowlist and global middleware in production;
- putting wedding admins in the marketplace `USERS` table, where `role=ADMIN` also grants marketplace admin;
- using its upload handling, which doesn't check file contents.

So `Wedding/server` is a small, independent API that follows Backend's conventions:
- Express 5 with ES modules;
- a `mysql2/promise` pool with the **same `MYSQL_*` variable names** and `timezone: "Z"`;
- `createXRoutes({ db })` route factories;
- `{ success, … }` / `{ success: false, code, message }` responses;
- inline transactions.

It can use the same MySQL server. **No file in `Backend/`, `Database/` or any other project was changed.**

## Getting started (local development)

Prerequisites: Node.js **20.9+** and a MySQL 5.7+/MariaDB 10.3+ server.

1. **Database.** Follow [`database/README.md`](database/README.md): run `migrations/000–009`, then `seeds/001_wedding_information.sql`, in MySQL Workbench.
2. **Configure the API.**
   ```bash
   cd server
   cp .env.example .env      # fill in MYSQL_*, IP_HASH_SALT
   npm install
   npm run create-admin -- --email you@example.com --name "Zulfitri"
   npm run dev               # http://localhost:4100  (GET /api/health → {"status":"ok"})
   ```
3. **Start the frontend** in another terminal, from `Wedding/`:
   ```bash
   npm install
   npm run dev               # http://localhost:5173 — /api is proxied to :4100
   ```
4. Open http://localhost:5173. The couple's dashboard is at http://localhost:5173/admin.

| Command (in `Wedding/`) | |
| --- | --- |
| `npm run dev` | Frontend dev server (proxies `/api` → `http://localhost:4100`, override with `WEDDING_API_PROXY`) |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | oxlint (frontend + server) |
| `npm test` | Frontend unit tests |
| `npm run dev:api` | Only the API (`npm run dev` inside `server/`) |
| `npm run dev:all` | API **and** frontend together (skips whichever is already running on 4100 / 5173) |
| `npm run serve` | Production build served on port 5173 with the same hosts and `/api` proxy |
| `npm run test:api` | API integration tests (needs `TEST_MYSQL_*`, see below) |

### Two processes must be running

| Process | Port | Start with | Check |
| --- | --- | --- | --- |
| Wedding API (`Wedding/server`) | 4100 | `cd server && npm run dev` | http://localhost:4100/api/health |
| Frontend (Vite) | 5173 | `npm run dev` (or `npm run serve` for the built site) | http://localhost:5173 |

`npm run dev:all` starts both. The shared GamerTavern `Backend/` (port 3002) is a separate application and is **not** used by the wedding site.

`/api/health` shows exactly what is missing:

| Response | Meaning |
| --- | --- |
| `{"database":"connected","schema":"ready"}` | All good |
| `"database":"not-configured"` | `server/.env` is missing `MYSQL_USER` / `MYSQL_DATABASE` |
| `"database":"unreachable"` | MySQL host, port or credentials are wrong, or the host blocks remote connections (cPanel → *Remote MySQL*) |
| `"schema":"missing"` | The SQL scripts in `database/` have not been run on that database yet |

### Troubleshooting

- **`[vite] http proxy error … ECONNREFUSED`** means the API is not running on port 4100. Start it (see above). While MySQL is unavailable, the API stays up and answers `503` with a friendly message, and the site shows a "Try again" notice instead of failing.
- **`Cannot read properties of null (reading 'useState')`** means the browser loaded two copies of React after the dev server re-optimized its dependencies. Common causes:
  - more than one Vite dev server running in this folder (they share `node_modules/.vite`). Keep only one: check with `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -match vite`;
  - a cache in front of the dev server, such as Cloudflare's *Browser Cache TTL*, keeping old `.js` modules. A dev-only plugin in `vite.config.js` marks source modules `no-store` to prevent this.

  Serving the production build (`npm run serve`) avoids this whole class of problem.

## Configuration

**Frontend, `Wedding/.env.local`:** public values only (see `.env.example`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | same origin | Backend **origin** only (e.g. `https://backend.nanashicollectibles.com`); requests go to `${VITE_API_BASE}/api/wedding/…`. Set in `.env.production`. Leave empty in development: `npm run dev` proxies `/api` to the standalone API on :4100 |
| `VITE_SOCKET_URL` | — | Not used. The wedding site has no Socket.IO / real-time features |
| `VITE_SITE_URL` | browser origin | Base for invite links and QR codes |

**API, `Wedding/server/.env`:** secrets live only here (see `server/.env.example`).

| Variable | Purpose |
| --- | --- |
| `MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE` | Connection (same names as Backend). Use a wedding-only MySQL user. |
| `PORT` | API port (default 4100; Backend uses 3002) |
| `IP_HASH_SALT` | Random secret for rate-limit hashes (**required in production**) |
| `ALLOWED_ORIGINS` | Comma-separated site origins allowed to call the API cross-origin |
| `PUBLIC_SITE_URL` | Public website URL |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `SESSION_TTL_HOURS` | Admin session cookie (`true` / `lax` / `12` in production) |
| `TRUST_PROXY` | Number of reverse proxies in front (1 for cPanel/nginx; 0 if exposed directly) |
| `UPLOAD_DIRECTORY` / `MAX_UPLOAD_MB` / `MAX_GIF_MB` / `MAX_VIDEO_MB` / `UPLOAD_QUOTA_MB` | Media storage location and limits (photo 15 MB, GIF 20 MB, video 95 MB, total 5 GB by default) |

In production (`NODE_ENV=production`), cookies default to `Secure`, and the API refuses to start without `IP_HASH_SALT`.

## Deployment (wedding.nanashicollectibles.com)

```
wedding.nanashicollectibles.com      static files (dist/)
backend.nanashicollectibles.com      GamerTavern Backend → /api/wedding/*  (this API, embedded)
devwedding.nanashicollectibles.com   Vite dev server → /api proxy → standalone API on :4100
```

**The API runs inside the shared Backend.** `Backend/server.js` loads `Wedding/server/src/embed.js` and mounts it at `/api/wedding`:
- The module uses **only** `Wedding/server/.env`, which it parses privately and never writes into the Backend's environment. It has its own MySQL pool, cookies (`Path=/api/wedding`), upload directory and error handler.
- If the module fails to load, the Backend logs `[wedding] module not loaded` and keeps serving the marketplace. Set `WEDDING_MODULE=off` to disable it.
- CORS is handled by the Backend: add frontend origins to `EXTRA_ORIGINS` in `Backend/.env.dev`. `X-CSRF-Token` is in its allowed headers.
- Changes to wedding server code take effect when the **Backend is restarted**.

**Releasing a frontend change:**
1. Run `npm run build`. This uses `.env.production`, so `VITE_API_BASE=https://backend.nanashicollectibles.com`.
2. Upload **everything** in `dist/` to the `wedding.` document root, including the hidden `.htaccess` (SPA routes; `/api/*` answers 404 there instead of `index.html`).
3. Run `npm run verify:api` for a read-only check of health, data, CORS for both wedding origins, the admin preflight and media files.

Uploads are stored in `UPLOAD_DIRECTORY` (`Wedding/server/uploads` by default) on the Backend machine. Back that folder up together with the `wedding_*` tables. The admin session cookie is `SameSite=Lax; Secure`. It works because `wedding.` and `backend.` are the same site (`nanashicollectibles.com`) and both use HTTPS.

**Standalone API (development, or another host):** run `cd server && npm run dev` (port 4100). It serves the same routes at `/api/wedding/*`, plus the legacy `/api/*`, and its own CORS allowlist comes from `ALLOWED_ORIGINS` in `server/.env`.

## Admin accounts and security

- **Admin access:**
  - No public registration and no default credentials.
  - Admins are created with `npm run create-admin`; passwords are bcrypt-hashed (12 rounds by default).
  - Sessions use a random token in an **HttpOnly**, `SameSite=Lax` (`Secure` in production) cookie; only its SHA-256 hash is stored.
  - Sessions expire after 12 hours, and logging out deletes them server-side.
  - Every admin write requires the session's **CSRF token** (`X-CSRF-Token`).
  - Login is rate-limited per IP and per email, and unknown emails take the same time as wrong passwords.
- **Request filtering:**
  - The API accepts JSON only, so cross-site HTML forms can't reach it.
  - Write requests from origins not in `ALLOWED_ORIGINS` are rejected.
- **Guest writes:**
  - Guest writes (wishes, RSVPs, uploads) are validated server-side.
  - They are rate-limited using salted hashes of IP addresses, de-duplicated, and protected by a honeypot field.
  - New wishes are **pending** until approved. Guest photos, GIFs and videos are published **immediately** after validation; the couple can hide or delete anything afterwards.
- **Invite links:**
  - Links are 24 random bytes; only the SHA-256 hash is stored, so the link is shown to the admin **once**.
  - "New link" replaces it and disables the old one.
  - Open RSVPs can never overwrite someone else's reply.
- **Photos, GIFs and videos:**
  - The real type is checked from file signatures: JPEG, PNG, WebP, GIF, MP4 and WebM only. HTML, SVG, scripts, executables and QuickTime `.mov` are rejected. HEIC/HEIF is converted to JPEG in the browser.
  - Photos are re-encoded by sharp, which strips EXIF/GPS. GIFs are re-encoded with their animation kept. Videos are stored as uploaded, with a poster frame captured in the browser.
  - Per-type limits apply (`MAX_UPLOAD_MB`, `MAX_GIF_MB`, `MAX_VIDEO_MB`; keep the video limit under Cloudflare's 100 MB request cap). There is also a total quota (`UPLOAD_QUOTA_MB`), per-IP rate limits and a per-IP daily volume limit.
  - Uploads stream to a private temp folder and are only listed once fully stored. Failed uploads are cleaned up, and stale temp files are swept hourly.
  - Files get random UUID names inside `UPLOAD_DIRECTORY`, with path-traversal checks. Videos support HTTP range requests for playback and seeking.
  - Hidden ("rejected") and private-album items return **404** to everyone except a signed-in admin.
  - GIF and video uploads need migration `010`. Until it is run, photos keep working and GIFs and videos are politely declined (`/api/health` shows `"mediaTypes"`).
- **Error handling:** database errors and stack traces are logged on the server only. Guests see friendly messages.

## Wedding information

Confirmed details from the official invitation are seeded into MySQL (`database/seeds/001_wedding_information.sql`) and editable in **/admin → Settings / Events**. The formal Malay wording, the Bismillah and salam, the "Yang Mulia" salutation, and "Yang Berharap" with the family list are reproduced exactly as printed.

Not on the invitation, so **left empty and hidden from guests** until you add them:
- your story;
- photos;
- dress code;
- FAQ;
- contacts;
- gift details;
- RSVP deadline;
- capacity;
- end time.

"Our Story" is switched off in *Settings → Website sections* until written.

## Testing

```bash
npm run lint && npm run build && npm test          # frontend
# API integration tests: need a DISPOSABLE MySQL/MariaDB (never production).
# Each run creates and drops its own wedding_it_* database.
cd server
TEST_MYSQL_HOST=127.0.0.1 TEST_MYSQL_PORT=3306 TEST_MYSQL_USER=root TEST_MYSQL_PASSWORD=… npm test
```

A throwaway test server can be started with Docker:

```bash
docker run -d --rm --name wedding-test-db -e MARIADB_ROOT_PASSWORD=testroot -p 127.0.0.1:33106:3306 mariadb:10.6
```
