// Prepares a picked photo, GIF or video for upload (browser only).
//   photos (JPEG/PNG/WebP/HEIC) → resized & re-encoded to JPEG (EXIF/GPS removed)
//   GIFs                        → uploaded as-is so the animation is kept
//   videos (MP4/WebM)           → uploaded as-is, plus a poster image taken from
//                                 an early frame (best effort; no server-side ffmpeg)
// The server re-validates every file's real type and size.
import { prepareImage } from './image.js'
import { mediaKind } from './validation.js'

const POSTER_MAX = 1280

/** Grabs a frame near the start of a video as a JPEG. Resolves null if the browser can't. */
export function makeVideoPoster(file, timeoutMs = 10000) {
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
      const t = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0
      video.currentTime = t
    }
    video.onseeked = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return finish(null)
        const scale = Math.min(1, POSTER_MAX / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => finish(blob ? { blob, width: w, height: h } : null), 'image/jpeg', 0.82)
      } catch {
        finish(null)
      }
    }
    video.src = url
  })
}

/** Returns { kind, blob, filename, width?, height?, poster? } ready for uploadMedia(). */
export async function prepareMedia(file) {
  const kind = mediaKind(file)
  if (kind === 'video') {
    const poster = await makeVideoPoster(file)
    const ext = /\.webm$/i.test(file.name) || file.type === 'video/webm' ? 'webm' : 'mp4'
    return { kind, blob: file, filename: `video.${ext}`, width: poster?.width, height: poster?.height, poster: poster?.blob }
  }
  if (kind === 'gif') return { kind, blob: file, filename: 'animation.gif' }
  const { full } = await prepareImage(file)
  return { kind: 'image', blob: full.blob, filename: 'photo.jpg', width: full.width, height: full.height }
}

/** Builds the multipart body shared by the guest and admin upload endpoints. */
export function mediaFormData(prepared, fields = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null && value !== '') form.append(key, value)
  if (prepared.width) form.append('width', String(prepared.width))
  if (prepared.height) form.append('height', String(prepared.height))
  if (prepared.poster) form.append('poster', prepared.poster, 'poster.jpg')
  form.append('photo', prepared.blob, prepared.filename)
  return form
}
