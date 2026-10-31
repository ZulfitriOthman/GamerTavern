// Image validation + processing.
//  1. The real type is detected from the file's magic bytes (JPEG/PNG/WebP);
//     the filename and client-declared MIME type are ignored.
//  2. The image is fully decoded by sharp (corrupt files and decompression
//     bombs are rejected via limitInputPixels).
//  3. It is re-encoded as JPEG: EXIF orientation applied, all metadata
//     (including GPS location) stripped, and a thumbnail generated.
import sharp from 'sharp'
import { badRequest } from './errors.js'

sharp.cache(false)

export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

const FULL_MAX = 2400
const THUMB_MAX = 720

export async function processImage(buffer, { thumbnail = true } = {}) {
  if (!sniffImageType(buffer)) throw badRequest('Only JPEG, PNG or WebP images are accepted.', 'UNSUPPORTED_FILE_TYPE')
  const base = () => sharp(buffer, { failOn: 'error', limitInputPixels: 60_000_000 }).rotate()
  try {
    const full = await base()
      .resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    const thumb = thumbnail
      ? await base()
          .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 78, mozjpeg: true })
          .toBuffer()
      : null
    return { full: full.data, thumb, width: full.info.width, height: full.info.height }
  } catch (error) {
    if (error.status) throw error
    throw badRequest('This image could not be read. Please try a different photo.', 'INVALID_IMAGE')
  }
}
