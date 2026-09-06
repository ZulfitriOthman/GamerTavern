# CLAUDE.md

This file is the operating guide for Claude Code when working in this folder (`Portfolio_Recce`).

## Important note on scope (read first)

This folder is a **standalone client portfolio website**, not a backend/merchant platform. It has **no server, no database, no authentication, no Socket.IO, and no payment system.**

If you were given generic instructions elsewhere referencing merchants, hotels, car rental, ticketing, tenant scoping, an "ARAH" or "b-jaur" product, office.b-jaur.com, or similar — **none of that applies to this repository.** This repo (and its parent monorepo) contain no reference to those terms anywhere in source, docs, or database files (verified by full-repo search). Do not invent or apply that context here.

This folder sits inside a larger git repository (monorepo root: `D:\Github\GamerTavern`), which also contains `Backend/`, `Database/`, `NanashiCollectibles/` (a TCG/esports/collectibles storefront with its own real backend, auth, and Socket.IO — see `../NanashiCollectibles/CLAUDE.md`), and two sibling client sites `Portfolio_Jae/` and `Portfolio_Zulfitri/`. `NanashiCollectibles/CLAUDE.md` explicitly calls the `Portfolio_*` folders **"unrelated"** sibling projects. Each `Portfolio_*` folder is a fully independent Vite app with its own `package.json` — treat `Portfolio_Recce` in isolation and do not assume it shares code, data, or a backend with any sibling folder unless you verify it directly.

All guidance below describes only what exists in `Portfolio_Recce/`.

## Project Overview

A single-page marketing/portfolio website for a Brunei-based drone operator ("Recce Ops" / Muhd Izrat), covering aerial cinematography, real estate, inspection, and mapping services. It is a client-facing brochure site: hero video, work/highlight reels, drone fleet specs, a services list, and a contact page. There is no user login, no forms that submit anywhere, and no dynamic/user-generated content — all content is hardcoded in `src/page/pageData.js`.

## Repository Architecture

```
Portfolio_Recce/
├── index.html            # Vite entry HTML, loads /src/main.jsx
├── src/
│   ├── main.jsx           # React root, wraps <App /> in <BrowserRouter>
│   ├── App.jsx             # Route table, shared header/footer/lightbox, scroll-reveal logic
│   ├── index.css           # Tailwind directives + global body background/reveal animation
│   ├── components/
│   │   ├── SiteHeader.jsx   # Fixed nav bar, mobile menu toggle, logo w/ image-fail fallback
│   │   ├── SiteFooter.jsx   # Copyright line
│   │   └── LightboxModal.jsx # Fullscreen image preview modal (see "Known dead code" below)
│   └── page/
│       ├── pageData.js      # ALL site content: hero video, gallery, fleet specs, services list
│       ├── HomePage.jsx
│       ├── WorkPage.jsx     # Highlight reel grid + video lightbox-on-click
│       ├── FleetPage.jsx
│       ├── ServicesPage.jsx
│       ├── ContactPage.jsx  # Hardcoded email/WhatsApp/Instagram/TikTok links
│       └── NotFoundPage.jsx
├── assets/
│   ├── images/             # profile-izrat.jpg, about-me.jpg, 2 drone photos
│   └── videos/             # Client's raw footage (.MP4, uppercase ext) — untracked in git as of this writing
├── script.js, styles.css   # LEGACY vanilla JS/CSS — see "Legacy code" below, not loaded by the app
├── vite.config.js, tailwind.config.js, postcss.config.js
└── package.json
```

## Technology Stack

- **React 18** (`react`, `react-dom`) with **React Router v6** (`react-router-dom`) for client-side routing.
- **Vite 5** as the dev server/bundler (`@vitejs/plugin-react`).
- **Tailwind CSS 3** + PostCSS/Autoprefixer for styling (utility classes throughout, plus a handful of custom theme tokens in `tailwind.config.js`: `skyaccent`, `warmaccent`, `font-display` = Bebas Neue, `font-body` = Sora, `animate-floatIn`).
- No state-management library — component-local `useState`/`useMemo` only.
- No test runner, no linter is configured in this package (`package.json` has no `lint` or `test` script).
- `@anthropic-ai/claude-code` is listed as a runtime dependency in `package.json` — this is unusual for a production app; it appears to be an artifact of how this project was scaffolded/edited rather than something the site itself uses. Needs verification if this was intentional; do not assume it's required for the site to run.

## Development Commands

Run from inside `Portfolio_Recce/` (this folder has its own `package.json` — do not run these from the monorepo root):

```
npm install     # install dependencies
npm run dev     # vite dev server (configured for port 5173, host: true)
npm run build   # vite build → dist/
npm run preview # preview the production build
```

There is no separate backend to start for this project — it is a pure static/client-rendered site. There are no lint or test scripts to run.

## Environment Configuration

No `.env` file, `.env.example`, or `import.meta.env.*` usage was found anywhere in this folder. This project has no environment variables. If a task seems to require one (API keys, backend URLs, etc.), that is a sign the work does not belong in this static site — verify with the user before adding a backend dependency here.

## Frontend Architecture

- **Routing** (`src/App.jsx`): `/` (Home), `/home` → redirects to `/`, `/work`, `/fleet`, `/services`, `/contact`, and a catch-all `*` → `NotFoundPage`.
- **Layout**: `SiteHeader` and `SiteFooter` are rendered once in `App.jsx` around `<Routes>`, so every page shares the same fixed header/footer.
- **Content model**: All copy, image paths, and video paths live in `src/page/pageData.js` as plain exported arrays/objects (`galleryItems`, `fleet`, `highlights`, `services`, `heroReel`). Pages receive this data as props from `App.jsx` — there is no fetch/API call anywhere in the codebase.
- **Scroll-reveal animation**: `App.jsx` uses an `IntersectionObserver` on any element with the `.reveal` class (defined in `src/index.css`) to fade/slide elements in on scroll, re-running on every route change. Elements can set a `data-delay` attribute (ms) to stagger animation via a CSS `--delay` variable.
- **Image fallback pattern**: `SiteHeader`, `ContactPage`, `FleetPage`, and `WorkPage` all use `onError` handlers on `<img>` tags plus local `useState` to swap to a text/icon fallback if an image 404s, rather than crashing or showing a broken-image icon. Follow this same pattern when adding new images.
- **Styling convention**: Tailwind utility classes inline on JSX elements; no CSS modules, no styled-components, no separate per-component stylesheets. Global/rare custom CSS only lives in `src/index.css`.

## Known Important Behaviors / Gaps (verified against actual files, not assumptions)

- **Broken media references**: `pageData.js` references `heroReel` (`/assets/videos/hero-reel.mp4`), `galleryItems[*].src` (`/assets/images/work-1.jpg` … `work-4.jpg`), and `highlights[*].src`/`.thumb` (`/assets/videos/highlight-1.mp4` … `highlight-4.mp4`) — **none of these filenames exist** in `assets/images/` or `assets/videos/`. The actual `assets/videos/` folder contains differently-named raw client footage (e.g. `pantai lumut 1.MP4`, `Kpg Ayer vid 1.MP4`). The hero video and all four "Work" highlight clips are therefore currently broken in the running app. Before "fixing" this, ask whether the intent is to (a) rename/re-map existing footage into `pageData.js`, or (b) that new final-cut assets are still pending from the client — do not silently rename raw client footage without confirming which clips map to which sections.
- **`WorkPage` doesn't receive `galleryItems`/`onImageOpen`**: `App.jsx` passes `galleryItems`, `highlights`, and `onImageOpen` to `<WorkPage />`, but `WorkPage.jsx` only destructures `{ highlights }`. `galleryItems` and `onImageOpen` (and therefore `LightboxModal`, which is rendered in `App.jsx` and only ever opened via `onImageOpen`) are currently dead/unwired — the still-image lightbox never opens today. `WorkPage` implements its own separate video-lightbox (`activeVideo` state) instead.
- **Legacy vanilla JS/CSS**: `script.js` and `styles.css` at the repo root are leftovers from an earlier non-React version of this site (the `README.md`'s "Open `index.html` in your browser" instructions describe that old version). `index.html` only loads `/src/main.jsx`; `script.js`/`styles.css` are not referenced anywhere and are not executed by the current app. Treat them as historical reference only, not live code, unless asked to fully revert to a static build.
- **`README.md` is stale**: it describes the old static-HTML version (manual placeholder replacement, GitHub Pages/Netlify/Vercel drag-and-drop) and doesn't mention the current React/Vite/Tailwind stack, `npm run dev`, or the routed pages. Prefer this CLAUDE.md and the actual source over `README.md` if they conflict.
- **Video assets and Git LFS**: `.gitattributes` tracks `*.mp4` via Git LFS, but the actual files in `assets/videos/` use an uppercase `.MP4` extension, and as of this audit that whole folder is **untracked** (`git status` shows `?? assets/videos/`). Case-sensitive LFS pattern matching may not catch these files as-is. Before committing anything in `assets/videos/`, check whether the intent is to rename to lowercase `.mp4`, add an additional LFS pattern, or exclude raw footage from git entirely — these are large binary files and an accidental non-LFS commit would bloat the repository history significantly. Do not `git add` this folder without raising this to the user first.
- **`@anthropic-ai/claude-code` in `dependencies`**: flagged above under Technology Stack — confirm before assuming it's needed by the deployed site.
- **Dev server `allowedHosts`** (`vite.config.js`) is pre-configured for `portfolio-recce.nanashicollectibles.com` and `.nanashicollectibles.com`, confirming this site is deployed as a subdomain of the `nanashicollectibles.com` domain (consistent with it being one of several client sites built alongside the `NanashiCollectibles` project in the same monorepo, even though the codebases are independent).

## Legacy / Technical Debt

- `script.js`, `styles.css` — superseded vanilla JS/CSS from the pre-React version (see above). Safe to ignore for feature work; do not delete without confirming nothing external still references the old static build.
- `README.md` — describes the old static workflow, not the current React app. Needs updating to match current reality, but only if asked.
- Broken hero/gallery/highlight media paths in `pageData.js` (see above) — real, currently-shipping bug, not a hypothetical.

## Coding Standards (as actually used in this codebase)

- JavaScript + JSX (`.jsx`), not TypeScript. No `.ts`/`.tsx` files anywhere in this folder.
- Function components with `function Name() { ... }` + `export default Name;` at the bottom — consistent across every component/page.
- Props are destructured directly in the function signature (e.g. `function FleetPage({ fleet }) { ... }`).
- One component/page per file; filenames match the exported component name (`PascalCase.jsx`).
- Pages live in `src/page/` (singular "page", not "pages") — match this existing folder name if adding new routes.
- Static content/data is centralized in `src/page/pageData.js` rather than inlined per-page — follow this for any new hardcoded content (drone specs, services, gallery items, etc.).
- Tailwind utility classes only; no CSS-in-JS, no BEM class naming, no separate stylesheet per component.
- No import aliasing (`@/...`) — all imports are relative (`./components/...`, `./page/...`).

## Database Change Rules

Not applicable — this folder has no database, no ORM, and no SQL files. If a task in this folder appears to require a database, that work belongs in a different part of the monorepo (see `../Database/` and `../Backend/`) — flag this to the user rather than adding backend/database code inside `Portfolio_Recce/`.

## Authentication & Authorization / Merchant Tenant Scoping / Socket.IO / Payments / Email Verification

Not applicable to this folder. This is a static content site with no login, no user accounts, no roles, no realtime channel, and no payment or email flows anywhere in the source. If you are asked to add any of these, treat it as new backend scope requiring an explicit decision from the user about where that backend should live (this folder currently has none) — do not fabricate schema, auth flows, or API contracts for a system that doesn't exist here.

## Security Rules

- No secrets exist in this folder (no `.env`, no API keys, no credentials found). If any are added later, never print their values back to the user or into commit messages.
- Do not add analytics/tracking, third-party form submission endpoints, or external scripts without explicit confirmation — the current site has zero third-party runtime dependencies beyond Google Fonts (`<link>` tags in `index.html`).

## Modification Workflow

For any non-trivial change in this folder:
1. Read `src/page/pageData.js` first — most content changes belong there, not scattered across page components.
2. Check whether the change affects a path referenced by multiple pages (e.g. `heroReel`, shared images) before editing.
3. Make the smallest change that fixes the actual issue; this is a small, flat codebase — prefer direct edits over new abstractions/helpers.
4. Run `npm run dev` and visually verify the affected route(s) in a browser (there is no automated test suite to rely on instead).
5. Report which files changed.

## Debugging Workflow

Observe the actual rendered page/console error → check `pageData.js` and the relevant page/component for the exact prop/path involved → change one thing → re-check in the dev server. Given the broken-media issue documented above, a "missing image/video" bug report should first be checked against actual filenames in `assets/`, not assumed to be a code bug.

## Things Claude Must Never Do (in this folder)

- Never assume this project has a backend, database, authentication, merchant/tenant logic, or Socket.IO — it doesn't. Don't import instructions from unrelated project contexts into this repo.
- Never `git add`/commit the raw video files in `assets/videos/` without first confirming LFS tracking and intent with the user (see LFS note above) — they are large binaries and currently untracked.
- Never silently rename or delete client footage files in `assets/videos/` to "fix" the broken media paths — confirm the intended mapping first.
- Never delete `script.js`/`styles.css`/`README.md` as "unused cleanup" without confirming — they're legacy but may still be referenced by the user's deployment notes or an external link.
- Never add a testing/linting framework, state-management library, TypeScript, or CSS-in-JS unless asked — none currently exist here and the codebase is intentionally minimal.
- Never install new dependencies without checking `package.json` first — this app currently has a very small dependency footprint by design.

## Before Implementing Any Feature

Read the specific page/component file(s) involved and `src/page/pageData.js` before writing code. Do not assume a prop, route, or asset exists — this file has already documented the ones that are currently broken; verify current state rather than trusting this document blindly for anything asset-related, since assets are the most likely thing to change over time.
