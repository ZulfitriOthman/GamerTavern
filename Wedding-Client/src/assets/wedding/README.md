# Majlis photos (optional)

Put photos in this folder using the file names from `src/data/weddingData.js`. They appear automatically, and every slot without a file shows a decorative placeholder clearly marked as a sample (*Gambar contoh*).

| File | Used for | Suggested size |
| --- | --- | --- |
| `venue.jpg` | Tempat Majlis card (Damai Ballroom) | landscape, 1600 × 1200 |
| `galeri-01.jpg` … `galeri-06.jpg` | Galeri. Set each photo's `width`/`height` ratio, caption and alt text in `weddingData.js` | any |

- **Formats:** JPEG, PNG, WebP or AVIF all work.
- **Captions:** when real photos are added, update the gallery captions and alt text (and remove the "Gambar contoh" note) in `weddingData.js`.
- **Size:** export at about 80% quality to keep the page fast on phones.
- **Why this folder:** Vite only bundles the files that exist and gives them cache-safe names. Missing photos never trigger a request or a console error.
