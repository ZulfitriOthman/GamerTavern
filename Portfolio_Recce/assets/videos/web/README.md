# Web-optimized video exports

These files are the only videos the live site actually ships. They're generated
from the raw camera masters in `assets/videos/` (which stay out of git — see the
repo root `.gitignore` — and are not referenced by any component directly).

## How these were made

The raw masters are extremely short (2–10s), 3840x2160, and encoded at roughly
100 Mbps — fine as camera output, unusable for the web (24–127MB per clip).
Each file here was re-encoded with ffmpeg:

```bash
ffmpeg -i "assets/videos/<source file>.MP4" \
  -vf "scale=1920:1080" \
  -c:v libx264 -preset slow -crf 22 \
  -pix_fmt yuv420p -movflags +faststart \
  -an \
  assets/videos/web/<output>.mp4
```

- Scaled to 1080p (source is already 16:9, so no letterboxing; never upscale a
  smaller source).
- `-an`: the source clips have no audio track, so there's nothing to carry over.
- `-movflags +faststart`: moves the moov atom to the front so playback can start
  before the whole file downloads.
- Result: ~370MB of raw source across 5 clips compresses to ~28MB total, with no
  visible quality loss at delivery size (spot-checked frame-by-frame).

Poster stills in `assets/images/poster-*.jpg` are real frames extracted from
these same encodes (`ffmpeg -ss <t> -i <clip> -vframes 1 -vf scale=960:-1`), not
stock or fabricated images.

## Adding a new highlight clip

1. Pick a source file from `assets/videos/`.
2. Run the ffmpeg command above against it, output into this folder.
3. Extract a poster frame the same way into `assets/images/`.
4. Import both in `src/page/pageData.js` and add an entry to `highlights`.

No project dependency on ffmpeg is required for `npm run dev` / `npm run build` —
it's only used offline to produce these files once.
