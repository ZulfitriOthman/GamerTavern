// Client-side validation for instant, friendly feedback. The Wedding API
// re-checks every rule (and file signatures) on the server.

export const LIMITS = {
  name: 80,
  relationship: 60,
  wishMin: 2,
  wish: 1000,
  rsvpName: 120,
  email: 254,
  phone: 40,
  rsvpMessage: 1000,
  caption: 300,
  filesPerBatch: 10,
  sourcePhotoBytes: 30 * 1024 * 1024, // before in-browser compression
  photoBytes: 15 * 1024 * 1024, // server MAX_UPLOAD_MB
  gifBytes: 20 * 1024 * 1024, // server MAX_GIF_MB
  videoBytes: 95 * 1024 * 1024, // server MAX_VIDEO_MB
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^[+()0-9\s-]{6,40}$/

export const clean = (s) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,.heic,.heif,.mp4,.webm,.gif'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'

/** 'image' | 'gif' | 'video' | null — a hint from the browser type/extension only. */
export function mediaKind(file) {
  const type = (file?.type || '').toLowerCase()
  const name = (file?.name || '').toLowerCase()
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif'
  if (type === 'video/mp4' || type === 'video/webm' || /\.(mp4|m4v|webm)$/.test(name)) return 'video'
  if (IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp|heic|heif)$/.test(name)) return 'image'
  return null
}

const mb = (bytes) => Math.round(bytes / 1024 / 1024)

export function checkMediaFile(file) {
  const kind = mediaKind(file)
  if (!kind) {
    if ((file?.type || '').startsWith('video/') || /\.mov$/i.test(file?.name || '')) {
      return 'This video format is not supported. Please share MP4 or WebM videos.'
    }
    return 'Only photos (JPEG, PNG, WebP, HEIC), GIFs and videos (MP4, WebM) can be shared.'
  }
  if (kind === 'video' && file.size > LIMITS.videoBytes) return `This video is too large (max ${mb(LIMITS.videoBytes)} MB).`
  if (kind === 'gif' && file.size > LIMITS.gifBytes) return `This GIF is too large (max ${mb(LIMITS.gifBytes)} MB).`
  if (kind === 'image' && file.size > LIMITS.sourcePhotoBytes) return `This photo is too large (max ${mb(LIMITS.sourcePhotoBytes)} MB).`
  return null
}

/** Returns { field: message } for the wish form. */
export function validateWish({ name, message, relationship }) {
  const errors = {}
  if (!clean(name)) errors.name = 'Please enter your name.'
  else if (clean(name).length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`
  if (clean(relationship).length > LIMITS.relationship) errors.relationship = `Please keep this under ${LIMITS.relationship} characters.`
  const m = clean(message)
  if (m.length < LIMITS.wishMin) errors.message = 'Please write a short message.'
  else if (m.length > LIMITS.wish) errors.message = `Please keep your message under ${LIMITS.wish} characters.`
  else if ((m.match(/https?:\/\/|www\./gi) ?? []).length > 2) errors.message = 'Please remove the links from your message.'
  return errors
}

export function validateRsvp({ name, email, phone, message }, responses) {
  const errors = {}
  if (!clean(name)) errors.name = 'Please enter your name.'
  else if (clean(name).length > LIMITS.rsvpName) errors.name = `Please keep your name under ${LIMITS.rsvpName} characters.`
  if (clean(email) && !EMAIL_RE.test(clean(email))) errors.email = 'Please enter a valid email address.'
  if (clean(phone) && !PHONE_RE.test(clean(phone))) errors.phone = 'Please enter a valid phone number.'
  if (clean(message).length > LIMITS.rsvpMessage) errors.message = `Please keep your message under ${LIMITS.rsvpMessage} characters.`
  if (!responses.length || responses.some((r) => typeof r.attending !== 'boolean')) {
    errors.responses = 'Please let us know whether you can attend each event.'
  }
  return errors
}
