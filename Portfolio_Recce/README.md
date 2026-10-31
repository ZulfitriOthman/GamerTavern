# Recce Ops — Drone Operator Portfolio

A single-page portfolio site for Muhd Izrat ("Recce Ops"), a Brunei-based drone
operator covering aerial cinematography, real estate, inspection, and mapping
work. It's a client-facing brochure site — hero, highlight reels, fleet specs,
a services list, and a contact page. There is no login, no user accounts, and
no data submitted anywhere by visitors.

## Tech Stack

- React 18 + React Router v6 (client-side routing, no SSR)
- Vite 5 (dev server / build)
- Tailwind CSS 3 (utility classes only, no CSS-in-JS)
- No backend, no database, no CMS. All content lives in `src/page/pageData.js`.

## Routes

| Path | Page |
| --- | --- |
| `/` | Home — hero, about |
| `/work` | Highlight reels (click-to-play video) |
| `/fleet` | Drone fleet specs |
| `/services` | Services, grouped by focus area |
| `/contact` | Contact links (email, WhatsApp, socials) |
| `/home` | Redirects to `/` |
| `*` | 404 |

## Development

```bash
npm install
npm run dev       # dev server, http://localhost:<port set in vite.config.js>
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

There's no lint or test script configured — none of that tooling exists in
this project by design; keep it that way unless there's a real need for it.

## Project Structure

```
Portfolio_Recce/
├── index.html            # Vite entry HTML — title, meta/OG tags, favicon
├── src/
│   ├── main.jsx           # React root, BrowserRouter
│   ├── App.jsx             # Route table, shared header/footer, scroll-reveal
│   ├── index.css           # Tailwind directives + global styles/animations
│   ├── components/         # SiteHeader, SiteFooter
│   └── page/
│       ├── pageData.js      # All site content: fleet specs, highlight clips, services
│       ├── HomePage.jsx, WorkPage.jsx, FleetPage.jsx,
│       └── ServicesPage.jsx, ContactPage.jsx, NotFoundPage.jsx
├── assets/
│   ├── images/              # Real photos (drones, profile) + video poster frames
│   └── videos/
│       ├── *.MP4             # Raw camera masters — gitignored, not shipped
│       └── web/              # Web-optimized exports the site actually uses
├── vite.config.js, tailwind.config.js, postcss.config.js
└── package.json
```

## Media / Assets — read this before touching video

- `assets/videos/*.MP4` are **raw client footage** — large (up to several
  hundred MB each), high-bitrate camera masters. They are gitignored and are
  not referenced by any component. Treat this folder as a source archive, not
  a web asset folder.
- `assets/videos/web/*.mp4` are the **only videos the site ships** — H.264,
  1080p, faststart-optimized exports generated from the raw masters. These
  *are* tracked in git (they're small, a few MB each) and are what
  `src/page/pageData.js` imports.
- See `assets/videos/web/README.md` for the exact ffmpeg command used and how
  to add a new highlight clip.
- Poster images (`assets/images/poster-*.jpg`) are real frames extracted from
  the web-optimized clips, not stock photography — used so the Work page never
  has to download a video just to show a thumbnail.
- Don't `git add` anything under `assets/videos/` directly — the `.gitignore`
  already scopes this correctly (raw `.MP4`/`.mp4` ignored, `web/` tracked);
  if you add a new raw master, no extra step is needed.

## Deployment

- Static build (`npm run build` → `dist/`) — deployable to any static host
  (Netlify, Vercel, GitHub Pages, a plain nginx/Apache server, etc.).
- No environment variables, no server-side code, no API keys.
- `vite.config.js` sets `server.allowedHosts` for local dev against a specific
  domain — irrelevant to production hosting, only affects `npm run dev`.
- Before shipping a new highlight clip, always add the *web-optimized* export,
  never the raw master — the raw files are 10–30x larger than necessary for a
  browser and will hurt load time badly if referenced directly.
