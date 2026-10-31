// Guest-facing API calls. No authentication; the API validates, de-duplicates
// and rate-limits every write.
import { api, upload } from '../lib/api.js'
import { clean } from '../lib/validation.js'
import { mediaFormData, prepareMedia } from '../lib/media.js'

const list = (body, key) => (Array.isArray(body?.[key]) ? body[key] : [])

export async function getSite(signal) {
  const body = await api('GET', '/public/site', { signal })
  return { settings: body.settings ?? null, events: list(body, 'events'), albums: list(body, 'albums') }
}

export async function getPhotos(limit = 200) {
  return list(await api('GET', `/public/photos?limit=${limit}`), 'photos')
}

export async function getWishes(page = 0, limit = 12) {
  const body = await api('GET', `/public/greetings?page=${page}&limit=${limit}`)
  return { items: list(body, 'items'), hasMore: Boolean(body.hasMore) }
}

/** → { status: 'published' | 'pending' | 'duplicate', item? } */
export async function submitWish({ name, relationship, message, website }) {
  return api('POST', '/public/greetings', {
    json: { name: clean(name), relationship: clean(relationship) || null, message: clean(message), website },
  })
}

export async function getInvitation(token) {
  const body = await api('GET', `/public/invitations/${encodeURIComponent(token)}`)
  return body.invitation
}

/** → { status: 'saved' | 'duplicate', events } */
export async function submitRsvp({ token, name, email, phone, message, responses, website }) {
  return api('POST', '/public/rsvps', {
    json: {
      token: token || undefined,
      name: clean(name),
      email: clean(email) || null,
      phone: clean(phone) || null,
      message: clean(message) || null,
      responses,
      website,
    },
  })
}

/** Prepares (compress / poster) and uploads one file. → { status, item? } */
export async function shareMedia(file, { name, caption, website }, onProgress) {
  const prepared = await prepareMedia(file)
  const form = mediaFormData(prepared, { name: clean(name), caption: clean(caption), consent: 'true', website })
  return upload('/public/photos', form, onProgress)
}
