// Client-side validation. Every rule here is re-checked on the server
// (Postgres RPCs and the guest-upload Edge Function) — this layer only
// exists to give guests instant, friendly feedback.

export const LIMITS = {
  name: 80,
  relationship: 60,
  greetingMin: 2,
  greeting: 1000,
  rsvpName: 120,
  email: 254,
  phone: 40,
  rsvpMessage: 1000,
  caption: 300,
  maxFilesPerBatch: 10,
  maxSourceFileBytes: 30 * 1024 * 1024, // photos, before in-browser compression
  maxUploadBytes: 15 * 1024 * 1024, // photos after compression (server MAX_UPLOAD_MB)
  maxGifBytes: 20 * 1024 * 1024, // server MAX_GIF_MB
  maxVideoBytes: 95 * 1024 * 1024, // server MAX_VIDEO_MB (Cloudflare caps requests at 100 MB)
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** What the guest file picker offers. The server re-checks every file's real signature. */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,.heic,.heif,.mp4,.webm,.gif'

/** Classifies a picked file by browser type / extension ('image' | 'gif' | 'video' | null). A hint only. */
export function mediaKind(file) {
  const type = (file?.type || '').toLowerCase()
  const name = (file?.name || '').toLowerCase()
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif'
  if (type === 'video/mp4' || type === 'video/webm' || /\.(mp4|m4v|webm)$/.test(name)) return 'video'
  if (ACCEPTED_IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp|heic|heif)$/.test(name)) return 'image'
  return null
}

const mb = (bytes) => Math.round(bytes / 1024 / 1024)

/** Checks a picked guest file (photo, GIF or video) before processing. Returns an error message or null. */
export function checkMediaFile(file) {
  const kind = mediaKind(file)
  if (!kind) {
    if ((file?.type || '').startsWith('video/') || /\.mov$/i.test(file?.name || '')) {
      return 'This video format is not supported. Please share MP4 or WebM videos.'
    }
    return 'Only photos (JPEG, PNG, WebP, HEIC), GIFs and videos (MP4, WebM) can be uploaded.'
  }
  if (kind === 'video' && file.size > LIMITS.maxVideoBytes) return `This video is too large (max ${mb(LIMITS.maxVideoBytes)} MB).`
  if (kind === 'gif' && file.size > LIMITS.maxGifBytes) return `This GIF is too large (max ${mb(LIMITS.maxGifBytes)} MB).`
  if (kind === 'image' && file.size > LIMITS.maxSourceFileBytes) return `This photo is too large (max ${mb(LIMITS.maxSourceFileBytes)} MB).`
  return null
}

const clean = (s) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^[+()\-\s\d]{6,40}$/

export function validateGreeting({ name, message, relationship }) {
  const errors = {}
  const n = clean(name)
  const m = clean(message)
  const r = clean(relationship)
  if (!n) errors.name = 'Please tell us your name.'
  else if (n.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`
  if (m.length < LIMITS.greetingMin) errors.message = 'Please write a short message.'
  else if (m.length > LIMITS.greeting) errors.message = `Please keep your message under ${LIMITS.greeting} characters.`
  if (r.length > LIMITS.relationship) errors.relationship = `Please keep this under ${LIMITS.relationship} characters.`
  return { errors, values: { name: n, message: m, relationship: r || null } }
}

export function validateRsvp({ name, email, phone, message, responses }, { requireContact = false } = {}) {
  const errors = {}
  const n = clean(name)
  const e = clean(email).toLowerCase()
  const p = clean(phone)
  const msg = clean(message)
  if (!n) errors.name = 'Please enter your name.'
  else if (n.length > LIMITS.rsvpName) errors.name = 'That name is too long.'
  if (e && (!EMAIL_RE.test(e) || e.length > LIMITS.email)) errors.email = 'Please enter a valid email address.'
  if (p && !PHONE_RE.test(p)) errors.phone = 'Please enter a valid phone number.'
  if (requireContact && !e && !p) errors.contact = 'Please share an email or phone number so we can reach you.'
  if (msg.length > LIMITS.rsvpMessage) errors.message = `Please keep your message under ${LIMITS.rsvpMessage} characters.`
  const chosen = (responses ?? []).filter((r) => r.attending !== null && r.attending !== undefined)
  if (chosen.length === 0) errors.responses = 'Please let us know whether you can attend.'
  for (const r of chosen) {
    if (r.attending && !(Number.isInteger(r.party_size) && r.party_size >= 1 && r.party_size <= (r.max ?? 20))) {
      errors.responses = 'Please choose a valid number of guests.'
    }
  }
  return {
    errors,
    values: {
      name: n,
      email: e || null,
      phone: p || null,
      message: msg || null,
      responses: chosen.map((r) => ({
        event_id: r.event_id,
        attending: Boolean(r.attending),
        party_size: r.attending ? r.party_size : 0,
      })),
    },
  }
}

export function validateUploadMeta({ name, caption, consent, files }) {
  const errors = {}
  const n = clean(name)
  const c = clean(caption)
  if (!n) errors.name = 'Please tell us your name.'
  else if (n.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`
  if (c.length > LIMITS.caption) errors.caption = `Please keep the caption under ${LIMITS.caption} characters.`
  if (!files?.length) errors.files = 'Please choose at least one photo, GIF or video.'
  else if (files.length > LIMITS.maxFilesPerBatch) errors.files = `Please upload up to ${LIMITS.maxFilesPerBatch} files at a time.`
  if (!consent) errors.consent = 'Please confirm the sharing notice before uploading.'
  return { errors, values: { name: n, caption: c || null } }
}

/** Checks a picked file before we try to decode it in the browser. */
export function checkImageFile(file) {
  const typeOk = ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  if (!typeOk) return 'Only JPEG, PNG, WebP or HEIC photos can be uploaded.'
  if (file.size > LIMITS.maxSourceFileBytes) return 'This photo is too large (max 30 MB).'
  return null
}

export const hasErrors = (errors) => Object.keys(errors).length > 0
