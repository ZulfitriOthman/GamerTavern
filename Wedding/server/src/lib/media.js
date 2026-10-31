// Media validation + processing for photos, animated GIFs and videos.
//
// The real format is ALWAYS detected from the file's signature (magic bytes);
// the filename and the browser-declared MIME type are ignored.
//   JPEG / PNG / WebP → decoded and re-encoded as JPEG by sharp (EXIF/GPS removed)
//   GIF               → decoded and re-encoded as an animated GIF (animation kept,
//                       metadata and any appended data dropped) + animated thumbnail
//   MP4 / WebM        → container signature verified, stored as uploaded; the
//                       poster image (made in the browser) is validated and
//                       re-encoded like any photo
// Anything else (HTML, SVG, scripts, executables, QuickTime .mov, …) is rejected.
import fs from 'node:fs/promises'
import sharp from 'sharp'
import { config } from '../config.js'
import { AppError, badRequest } from './errors.js'
import { processImage } from './images.js'

sharp.cache(false)

const MB = 1024 * 1024
const GIF_MAX = 1600
const THUMB_MAX = 720
const MAX_PIXELS = 60_000_000

// ISO-BMFF "major brands" that are MP4. QuickTime ('qt  ') and HEIF brands are excluded.
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'mmp4', 'M4V ', 'MSNV', 'f4v '])

export const UNSUPPORTED_MESSAGE = 'Only photos (JPEG, PNG, WebP), GIFs and videos (MP4, WebM) can be uploaded.'

/** Detects the real file type from its first bytes. Returns null when unsupported. */
export function sniffMedia(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  const head6 = buf.toString('latin1', 0, 6)
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif'
  if (buf.toString('latin1', 4, 8) === 'ftyp' && MP4_BRANDS.has(buf.toString('latin1', 8, 12))) return 'mp4'
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 && buf.subarray(0, 64).includes(Buffer.from('webm'))) return 'webm'
  return null
}

async function readHead(filePath, bytes = 64) {
  const handle = await fs.open(filePath, 'r')
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(bytes), 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

function tooLarge(kind, limitMb) {
  return new AppError(413, 'FILE_TOO_LARGE', `This ${kind} is too large. The limit is ${limitMb} MB.`)
}

const dim = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null
}

async function processGif(buffer) {
  const base = () => sharp(buffer, { animated: true, failOn: 'error', limitInputPixels: MAX_PIXELS })
  try {
    const meta = await base().metadata()
    const width = meta.width
    const height = meta.pageHeight ?? meta.height
    const full = await base()
      .resize({ width: GIF_MAX, height: GIF_MAX, fit: 'inside', withoutEnlargement: true })
      .gif()
      .toBuffer()
    const thumb = await base()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .gif()
      .toBuffer()
    const scale = Math.min(1, GIF_MAX / Math.max(width, height))
    return { full, thumb, width: Math.round(width * scale), height: Math.round(height * scale), frames: meta.pages ?? 1 }
  } catch {
    throw badRequest('This GIF could not be read. Please try a different file.', 'INVALID_IMAGE')
  }
}

/**
 * Validates and processes one uploaded file (multer disk file) plus an optional
 * poster image for videos. Never trusts file.mimetype or file.originalname.
 *
 * Returns { mediaType, mimeType, ext, width, height,
 *           fullBuffer | fullTempPath, thumbBuffer | null }
 */
export async function processUpload(file, poster, fields = {}) {
  if (!file?.path || !file.size) throw badRequest('Please choose a photo, GIF or video to upload.')
  let head
  try {
    head = await readHead(file.path)
  } catch (error) {
    // The temp file vanished or was locked — e.g. antivirus quarantined it (seen with
    // Windows Defender on webshell-like content). Treat it as an unacceptable file.
    console.warn(`[wedding-api] upload temp file unreadable (${error.code}); rejecting`)
    throw badRequest(UNSUPPORTED_MESSAGE, 'UNSUPPORTED_FILE_TYPE')
  }
  const kind = sniffMedia(head)
  if (!kind) throw badRequest(UNSUPPORTED_MESSAGE, 'UNSUPPORTED_FILE_TYPE')
  const { maxFileMb, maxGifMb, maxVideoMb } = config.uploads

  if (kind === 'mp4' || kind === 'webm') {
    if (file.size > maxVideoMb * MB) throw tooLarge('video', maxVideoMb)
    let thumbBuffer = null
    let width = dim(fields.width)
    let height = dim(fields.height)
    if (poster?.path && poster.size) {
      if (poster.size > maxFileMb * MB) throw badRequest('Invalid video preview image.')
      // The poster is re-encoded like any photo; a bad poster just means "no preview".
      try {
        const processed = await processImage(await fs.readFile(poster.path))
        thumbBuffer = processed.thumb
        width ??= processed.width
        height ??= processed.height
      } catch {
        thumbBuffer = null
      }
    }
    return { mediaType: 'video', mimeType: `video/${kind}`, ext: kind, width, height, fullTempPath: file.path, thumbBuffer }
  }

  if (kind === 'gif') {
    if (file.size > maxGifMb * MB) throw tooLarge('GIF', maxGifMb)
    const gif = await processGif(await fs.readFile(file.path))
    // A single-frame GIF is just a picture; it is still kept as GIF.
    return { mediaType: 'gif', mimeType: 'image/gif', ext: 'gif', width: gif.width, height: gif.height, fullBuffer: gif.full, thumbBuffer: gif.thumb }
  }

  if (file.size > maxFileMb * MB) throw tooLarge('photo', maxFileMb)
  const image = await processImage(await fs.readFile(file.path))
  return { mediaType: 'image', mimeType: 'image/jpeg', ext: 'jpg', width: image.width, height: image.height, fullBuffer: image.full, thumbBuffer: image.thumb }
}
