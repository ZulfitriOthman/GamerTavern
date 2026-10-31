// Prepares a picked file for upload, in the browser:
//   photos (JPEG/PNG/WebP/HEIC) → resized & re-encoded to JPEG, which strips EXIF/GPS
//   GIFs                        → sent as-is so the animation is kept
//   videos (MP4/WebM)           → sent as-is, plus a poster frame (best effort)
// The server re-validates the real type and size of every file.
import { mediaKind } from './validation.js'

const FULL_MAX = 2400
const POSTER_MAX = 1280

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall back to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toJpeg(source, width, height, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // flatten transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve({ blob, width: canvas.width, height: canvas.height }) : reject(new Error('encode'))), 'image/jpeg', quality),
  )
}

export async function prepareImage(file, maxSide = FULL_MAX) {
  let source
  try {
    source = await decode(file)
  } catch {
    throw new Error('This photo could not be read on this device. Please try a JPEG or PNG.')
  }
  try {
    return await toJpeg(source, source.width, source.height, maxSide, 0.86)
  } finally {
    source.close?.()
  }
}

/** A JPEG frame from near the start of a video, or null if the browser can't. */
export function videoPoster(file, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish(null)
    video.onloadedmetadata = () => {
      video.currentTime = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0
    }
    video.onseeked = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return finish(null)
      toJpeg(video, w, h, POSTER_MAX, 0.82).then(
        (jpeg) => finish({ blob: jpeg.blob, width: w, height: h }),
        () => finish(null),
      )
    }
    video.src = url
  })
}

/** → { kind, blob, filename, width?, height?, poster? } */
export async function prepareMedia(file) {
  const kind = mediaKind(file)
  if (kind === 'video') {
    const poster = await videoPoster(file)
    const ext = /\.webm$/i.test(file.name) || file.type === 'video/webm' ? 'webm' : 'mp4'
    return { kind, blob: file, filename: `video.${ext}`, width: poster?.width, height: poster?.height, poster: poster?.blob }
  }
  if (kind === 'gif') return { kind, blob: file, filename: 'animation.gif' }
  const full = await prepareImage(file)
  return { kind: 'image', blob: full.blob, filename: 'photo.jpg', width: full.width, height: full.height }
}

/** Multipart body accepted by both the guest and the admin upload endpoints. */
export function mediaFormData(prepared, fields = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null && value !== '') form.append(key, value)
  if (prepared.width) form.append('width', String(prepared.width))
  if (prepared.height) form.append('height', String(prepared.height))
  if (prepared.poster) form.append('poster', prepared.poster, 'poster.jpg')
  form.append('photo', prepared.blob, prepared.filename)
  return form
}
