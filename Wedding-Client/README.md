# Majlis Menghantar Berian, Akad Nikah & Bersanding: digital invitation

The digital invitation for **Jumaat, 22 Januari 2027 (14 Syaaban 1448H)** at **Damai Ballroom Aman Hills**, Bandar Seri Begawan.

It is a **100% static** website built with React 19, Vite, Tailwind CSS v4, Motion and Lucide icons.

- **No backend:** there is no API, database, login or environment variable.
- **One data file:** all content comes from `src/data/weddingData.js`.

## Run it

```bash
npm install
npm run dev        # dev server (port 5173, see vite.config.js) — no backend needed
npm run build      # static files in dist/
npm run preview    # serve the build locally
npm test           # unit tests: exact names (couple and families), date, venue, programme, countdown
npm run lint
```

`dist/` can be hosted anywhere static: cPanel, Netlify, Vercel, GitHub Pages or S3.

## Content (`src/data/weddingData.js`)

| Key | What |
| --- | --- |
| `event` | Title (and how it breaks onto lines), day, date text, Hijri date, ISO date, countdown start time (1:15 PM) and time zone (`Asia/Brunei`) |
| `couple` | Pengantin Lelaki and Pengantin Perempuan: full official name (invitation), shorter name (hero), short name ("Naqiuddin & Syafina" headings) and initial (the "N & S" monogram) |
| `opening` | Bismillahirrahmanirrahim (Arabic and Latin) |
| `venue` | Name, address lines, optional Google Maps link and photo |
| `families` | Pihak Lelaki (11) and Pihak Perempuan (6), in the supplied order |
| `programme` | Atur Cara Majlis: the time labels and activities exactly as supplied |
| `gallery` | Sample placeholder tiles, clearly marked *Gambar contoh* |
| `closing` | Penutup message |
| `site` | Browser-tab title and WhatsApp/social preview text (injected into `index.html` at build time) |
| `presentation` | Envelope intro on/off and the navigation links |

**The supplied details are copied exactly.** `tests/lib.test.js` repeats them independently: every name in order, the title, day, date, Hijri date, address and programme. Any accidental edit to `weddingData.js` makes `npm test` fail.

**Not shown, because not confirmed:** end times, and times for Majlis Bersanding and the doa or jamuan. The countdown and the calendar entry use **1:15 PM**, the start of Menerima Jemputan, and the calendar entry has no invented end time.

## Sections (one page)

| Section | Component |
| --- | --- |
| Invitation cover: two paper flaps closed with a burgundy wax seal. **Buka Undangan** swings them open (a simple fade with reduced motion). Optional, once per visit; Langkau skips it. | `sections/Envelope.jsx` |
| Utama: Bismillah, title, the couple's names, day, date, Hijri date and venue in a large layered mihrab arch, with florals at its lower corners and bottom edge | `sections/Hero.jsx` |
| Countdown, plus "Simpan ke Kalendar" | `sections/Countdown.jsx` |
| Undangan: Pengantin Lelaki and Pengantin Perempuan (full names), then Pihak Lelaki and Pihak Perempuan | `sections/Families.jsx` |
| Atur Cara Majlis | `sections/Programme.jsx` |
| Tempat Majlis, plus "Dapatkan Arah" (Google Maps link, no API key) | `sections/Venue.jsx` |
| Galeri (placeholders) and lightbox | `sections/Gallery.jsx`, `gallery/Lightbox.jsx` |
| Penutup | `sections/Closing.jsx` |

**The arch.** The mihrab arch is the recurring frame. `ui/ArchPanel.jsx` puts it on the Undangan cards, Atur Cara, Tempat Majlis and Terima Kasih.

**Ornaments.** All of these are original inline SVG artwork, so they need no image files or licences:
- `components/decor/Floral.jsx`: burgundy roses, mauve blossoms and buds on thin branches with brown leaves. It provides `FloralCorner`, `FloralGarland`, `FloralDivider` and `Sprig`.
- `components/decor/Geometric.jsx`: the Islamic 8-point star, the geometric border band, and the layered `MihrabFrame`, which is drawn to the element's measured size so the layers stay evenly spaced.
- `sections/Envelope.jsx`: the wax seal.
- `index.css`: the paper and geometric background textures.

## Sharing on WhatsApp

`index.html` carries the Open Graph and Twitter tags: title, description, page URL and a 1200 × 630 preview image (`public/og-image.jpg`).

- **The site's address** is `site.url` in `weddingData.js` (now `https://devwedding.nanashicollectibles.com`). WhatsApp needs absolute links, so `og:url` and `og:image` are built from it at build time. If the site moves to another domain, change it and rebuild.
- The image link ends in `?v=<hash of the file>`, so after the image is regenerated WhatsApp fetches it again instead of showing its cached copy.
- **If the names, date, venue or title change,** update `tools/og-image/og-image.html` too, then regenerate the image with `node tools/og-image/render.mjs tools/og-image/og-image.html public/og-image.jpg`. This needs Google Chrome installed.

## Colours and fonts

The look is **white textured paper, soft grey Islamic geometry, burgundy and dusty-mauve florals, and a touch of antique bronze**. The palette is defined once at the top of `src/index.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#581c30` | burgundy: headings, buttons, key text |
| `--color-floral` | `#a66d83` | dusty mauve: flowers, ornaments, the "&" |
| `--color-background` | `#faf9f7` | ivory paper (the page) |
| `--color-surface` | `#ffffff` | arches and cards |
| `--color-grey` | `#e6e5e3` | soft grey lines and borders |
| `--color-bronze` | `#9b7865` | antique bronze: fine arch lines, stars |
| `--color-text` | `#341f29` | text |
| `--color-muted` | `#756c70` | secondary text |

Mauve and bronze are below 4.5:1 contrast on ivory, so they're used for ornaments and large text only. Small bronze labels use `bronze-deep` (`#765746`). Other named shades (`mist`, `frost`, `haze`, `blush`, `leaf`) are built from the palette.

**Fonts** (Google Fonts, loaded in `index.html`):
- **Cinzel:** engraved capitals for headings, labels and buttons.
- **Cormorant Garamond:** names, the programme, closing text and italic accents.
- **Libre Baskerville:** small paragraph text, such as the address.
- **Amiri:** the Arabic Bismillah.

**Texture.** `bg-paper` (the paper grain) and `bg-geometric` (the grey 8-point-star lattice) are inline SVG in `index.css`, so they need no image requests.

## Photos

Optional. Put `venue.jpg` and `galeri-01.jpg` … `galeri-06.jpg` in `src/assets/wedding/`; see the README in that folder. Missing photos show placeholders and cause no requests.

## Project structure

```
src/
  App.jsx                  sections in page order
  data/weddingData.js      ALL content
  assets/wedding/          optional photos
  components/
    sections/              Hero, Countdown, Families, Programme, Venue, Gallery, Closing, Envelope
    layout/                Navbar, Footer, navItems, scrollToHash
    decor/                 Floral.jsx, Geometric.jsx
    events/CalendarMenu.jsx
    gallery/Lightbox.jsx
    ui/                    Section/SectionTitle, ArchPanel, Reveal, SmartImage, PhotoPlaceholder, Field, Notice (form/notice parts kept for future use)
  lib/                     time & countdown, calendar, content helpers, image lookup
  index.css                colour palette & design tokens, components, background patterns
tests/lib.test.js
tools/og-image/            WhatsApp preview card source + renderer
archive/                   earlier versions, not built (see below)
```

## Archived code (not built)

- `archive/api-connected/`: the earlier API version (admin dashboard, saved RSVPs and wishes, uploads).
- `archive/static-template/`: generic template sections this invitation doesn't use (love story, bride & groom, multi-event cards, wishes) with their placeholder data.

`database/` holds SQL for the API version and is not used by this static site.
