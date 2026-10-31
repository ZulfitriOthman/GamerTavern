// Guest photo upload endpoint (Supabase Edge Function, Deno).
//
// Accepts multipart/form-data with:
//   photo   (file, required)  – full-size image
//   thumb   (file, optional)  – gallery thumbnail
//   name    (text, required)  – uploader's name
//   caption (text, optional)
//   consent ("true", required)
//   width / height (optional integers, layout hints only)
//   website (honeypot — must be empty)
//
// The file's real type is detected from its magic bytes, never from the
// filename or client-declared content type. Files are stored under random
// UUID names in the PRIVATE `wedding-photos` bucket and recorded as
// `pending`; nothing is visible publicly until an admin approves it.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_THUMB_BYTES = 1.5 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + MAX_THUMB_BYTES + 64 * 1024
const BUCKET = 'wedding-photos'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowedOrigins.length === 0 ? '*' : origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

type Sniffed = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

function sniffImage(bytes: Uint8Array): Sniffed | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return { mime: 'image/png', ext: 'png' }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

const clean = (v: FormDataEntryValue | null, max: number): string | null => {
  if (typeof v !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  return s ? s.slice(0, max + 1) : null
}

const toDim = (v: FormDataEntryValue | null) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null
}

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const fail = (status: number, error: string) => json(status, { error })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return fail(405, 'Method not allowed.')

  const length = Number(req.headers.get('content-length') ?? '0')
  if (!length || length > MAX_REQUEST_BYTES) return fail(413, 'This photo is too large. Please choose one under 8 MB.')
  if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) return fail(400, 'Invalid upload.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return fail(500, 'Uploads are not configured.')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Invalid upload.')
  }

  // Honeypot: pretend success for bots, store nothing.
  if (clean(form.get('website'), 200)) return json(200, { status: 'pending' })

  const name = clean(form.get('name'), 80)
  const caption = clean(form.get('caption'), 300)
  if (!name || name.length > 80) return fail(400, 'Please enter your name (up to 80 characters).')
  if (caption && caption.length > 300) return fail(400, 'Please keep the caption under 300 characters.')
  if (form.get('consent') !== 'true') return fail(400, 'Please confirm the privacy notice before uploading.')

  const photo = form.get('photo')
  const thumb = form.get('thumb')
  if (!(photo instanceof File)) return fail(400, 'Please choose a photo to upload.')
  if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) return fail(413, 'This photo is too large. Please choose one under 8 MB.')
  if (thumb !== null && (!(thumb instanceof File) || thumb.size === 0 || thumb.size > MAX_THUMB_BYTES)) {
    return fail(400, 'Invalid thumbnail.')
  }

  const photoBytes = new Uint8Array(await photo.arrayBuffer())
  const photoType = sniffImage(photoBytes)
  if (!photoType) return fail(415, 'Only JPEG, PNG or WebP images are accepted.')
  let thumbBytes: Uint8Array | null = null
  let thumbType: Sniffed | null = null
  if (thumb instanceof File) {
    thumbBytes = new Uint8Array(await thumb.arrayBuffer())
    thumbType = sniffImage(thumbBytes)
    if (!thumbType) return fail(415, 'Only JPEG, PNG or WebP images are accepted.')
  }

  // Feature switch + guest album.
  const { data: settings, error: settingsError } = await admin
    .from('wedding_settings')
    .select('photo_uploads_enabled')
    .eq('id', 1)
    .maybeSingle()
  if (settingsError) return fail(500, 'Uploads are temporarily unavailable.')
  if (!settings?.photo_uploads_enabled) return fail(403, 'Photo sharing is not open right now.')

  const { data: allowed, error: quotaError } = await admin.rpc('consume_upload_quota', { p_ip: clientIp(req) })
  if (quotaError) return fail(500, 'Uploads are temporarily unavailable.')
  if (!allowed) return fail(429, 'You have shared a lot of photos in a short time — thank you! Please try again a little later.')

  const { data: album } = await admin.from('photo_albums').select('id').eq('is_guest_uploads', true).maybeSingle()

  const month = new Date().toISOString().slice(0, 7)
  const id = crypto.randomUUID()
  const photoPath = `guest/${month}/${id}.${photoType.ext}`
  const thumbPath = thumbType ? `guest/${month}/${id}_thumb.${thumbType.ext}` : null

  const up1 = await admin.storage.from(BUCKET).upload(photoPath, photoBytes, { contentType: photoType.mime, upsert: false })
  if (up1.error) return fail(500, 'We could not save your photo. Please try again.')
  if (thumbPath && thumbBytes && thumbType) {
    const up2 = await admin.storage.from(BUCKET).upload(thumbPath, thumbBytes, { contentType: thumbType.mime, upsert: false })
    if (up2.error) {
      await admin.storage.from(BUCKET).remove([photoPath])
      return fail(500, 'We could not save your photo. Please try again.')
    }
  }

  const { error: insertError } = await admin.from('wedding_photos').insert({
    id,
    album_id: album?.id ?? null,
    storage_path: photoPath,
    thumb_path: thumbPath,
    caption,
    uploader_name: name,
    source: 'guest',
    status: 'pending',
    width: toDim(form.get('width')),
    height: toDim(form.get('height')),
    consent_at: new Date().toISOString(),
  })
  if (insertError) {
    await admin.storage.from(BUCKET).remove([photoPath, ...(thumbPath ? [thumbPath] : [])])
    return fail(500, 'We could not save your photo. Please try again.')
  }

  return json(201, { status: 'pending', id })
})
