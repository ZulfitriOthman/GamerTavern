// Listing images. Same limits as the Backend's product-image uploader (multer,
// 5 MB, PNG/JPEG/WebP/GIF) but stricter and private:
//   - the file's own signature decides its type (the client's MIME type and
//     file name are ignored), so nothing else can be stored or served;
//   - files live in the module's private storage directory under a random,
//     server-generated name — never in Backend/public — and are only served
//     through API routes that check access first.
import { randomBytes } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import multer from 'multer'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const SAFE_NAME = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/

export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  const head = buf.subarray(0, 6).toString('latin1')
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

export function createImageStore(storageDir, folder = 'listings') {
  const dir = join(storageDir, folder)
  mkdirSync(dir, { recursive: true })
  return {
    save(buffer, type) {
      const name = `${randomBytes(16).toString('hex')}.${TYPES[type]}`
      writeFileSync(join(dir, name), buffer, { flag: 'wx' })
      return name
    },
    remove(name) {
      if (!name || !SAFE_NAME.test(name)) return
      try {
        unlinkSync(join(dir, name))
      } catch {
        // already gone — nothing to clean up
      }
    },
    path(name) {
      return name && SAFE_NAME.test(name) ? join(dir, name) : null
    },
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
}).single('image')

// Resolves to { buffer, type } or rejects with an error carrying .status/.expose.
export function receiveImage(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      const fail = (status, message) => reject(Object.assign(new Error(message), { status, expose: true }))
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(413, 'Image must be 5 MB or smaller.')
        return fail(400, 'Upload exactly one image in the "image" field.')
      }
      if (!req.file) return fail(400, 'Upload exactly one image in the "image" field.')
      const type = detectImageType(req.file.buffer)
      if (!type) return fail(400, 'Only PNG, JPEG, WebP or GIF images are allowed.')
      resolve({ buffer: req.file.buffer, type })
    })
  })
}

// Streams a stored image after the caller has already checked access.
export function sendImage(res, store, name, type) {
  const file = store.path(name)
  if (!file || !TYPES[type]) return res.status(404).json({ error: 'Not found.' })
  res.set({
    'Content-Type': type,
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
  })
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Not found.' })
  })
}
