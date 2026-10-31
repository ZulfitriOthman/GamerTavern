# Archived: API-connected version (not built, not used)

This is a full snapshot of `Wedding-Client` from **before it became a static site** (28 Oct 2026). It is kept so the real features can be brought back later. These were:

- the `/admin` dashboard
- RSVP saving and personal `/rsvp/:token` links
- live wishes and photo sharing

**Nothing here is built, linted or imported.** Vite only bundles `../../src`.

Contents:
- `src/`: the complete API-connected frontend.
  - `services/` and `lib/api.js`: API calls.
  - `admin/`: the dashboard.
  - `context/SiteContext.jsx`: loads content from the API.
- `scripts/api.mjs` and `server.env.example`: ran a separate instance of `../Wedding/server` for this site.
- `vite.config.js`: the `/api` dev proxy.
- `package.json` and `README.md`: the old scripts, dependencies (including `qrcode` and `react-router-dom`) and setup notes.
- `tests/`: the old unit tests.

The SQL for this site's content is still in `../../database/` and was not changed.

**Restoring:** this needs the old dependencies reinstalled, plus its own API instance and database. The previous `README.md` here has the setup steps.
