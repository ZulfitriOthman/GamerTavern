// Admin data access through the wedding API. Authorisation is enforced by the
// server on every request (session cookie + CSRF token); hiding the admin UI
// is not the protection.
import { api, requireArray, setCsrfToken, upload } from '../lib/api.js'
import { mediaFormData } from '../lib/mediaUpload.js'
import { withMediaUrls } from './photoService.js'

// --- auth ------------------------------------------------------------------
export async function signIn(email, password) {
  const { admin, csrfToken } = await api('POST', '/auth/login', { json: { email, password } })
  setCsrfToken(csrfToken)
  return admin
}
export async function signOut() {
  try {
    await api('POST', '/auth/logout')
  } finally {
    setCsrfToken('')
  }
}
/** Returns the signed-in admin or null. */
export async function getSession() {
  const { admin, csrfToken } = await api('GET', '/auth/session')
  setCsrfToken(admin ? csrfToken : '')
  return admin
}

// --- overview ---------------------------------------------------------------
export const fetchStats = async () => (await api('GET', '/admin/stats')).stats

// --- settings ---------------------------------------------------------------
export const fetchSettings = async () => (await api('GET', '/admin/settings')).settings
export const saveSettings = async (patch) => (await api('PUT', '/admin/settings', { json: patch })).settings

/** Uploads a hero/story image; returns its URL path (stored in the content). */
export async function uploadSiteAsset(blob) {
  const form = new FormData()
  form.append('image', blob, 'image.jpg')
  return (await upload('/admin/assets', form)).url
}

// --- events -----------------------------------------------------------------
export const listEvents = async () => requireArray(await api('GET', '/admin/events'), 'events', '/admin/events')
export async function saveEvent(event) {
  const { id, created_at: _c, updated_at: _u, ...fields } = event
  return (await api(id ? 'PUT' : 'POST', id ? `/admin/events/${id}` : '/admin/events', { json: fields })).event
}
export const deleteEvent = (id) => api('DELETE', `/admin/events/${id}`)

// --- guests -----------------------------------------------------------------
export const listGuests = async () => requireArray(await api('GET', '/admin/guests'), 'guests', '/admin/guests')
/** Creates guests; returns [{ id, name, token }] — tokens are shown once only. */
export const createGuests = async (guests) => requireArray(await api('POST', '/admin/guests', { json: { guests } }), 'created', '/admin/guests')
export async function updateGuest(guest) {
  const { id, name, email, phone, max_party_size, notes } = guest
  return api('PUT', `/admin/guests/${id}`, { json: { name, email, phone, max_party_size, notes } })
}
/** Issues a new private RSVP link (the previous link stops working). */
export const regenerateInviteLink = async (id) => (await api('POST', `/admin/guests/${id}/invite-link`)).token
export const deleteGuest = (id) => api('DELETE', `/admin/guests/${id}`)

// --- rsvps ------------------------------------------------------------------
export const listRsvps = async () => requireArray(await api('GET', '/admin/rsvps'), 'rsvps', '/admin/rsvps')
export const updateRsvp = (id, patch) => api('PUT', `/admin/rsvps/${id}`, { json: patch })
export const deleteRsvp = (id) => api('DELETE', `/admin/rsvps/${id}`)

// --- greetings --------------------------------------------------------------
export const listGreetings = async (status) =>
  requireArray(await api('GET', `/admin/greetings?status=${encodeURIComponent(status)}`), 'greetings', '/admin/greetings')
export const setGreetingStatus = (id, status) => api('PATCH', `/admin/greetings/${id}`, { json: { status } })
export const deleteGreeting = (id) => api('DELETE', `/admin/greetings/${id}`)

// --- albums -----------------------------------------------------------------
export const listAlbums = async () => requireArray(await api('GET', '/admin/albums'), 'albums', '/admin/albums')
export async function saveAlbum(album) {
  const { id, created_at: _c, updated_at: _u, ...fields } = album
  return (await api(id ? 'PUT' : 'POST', id ? `/admin/albums/${id}` : '/admin/albums', { json: fields })).album
}
export const deleteAlbum = (id) => api('DELETE', `/admin/albums/${id}`)

// --- photos -----------------------------------------------------------------
export async function listPhotos(status) {
  return requireArray(await api('GET', `/admin/photos?status=${encodeURIComponent(status)}`), 'photos', '/admin/photos').map(withMediaUrls)
}
export const updatePhoto = (id, patch) => api('PATCH', `/admin/photos/${id}`, { json: patch })
export const deletePhoto = (photo) => api('DELETE', `/admin/photos/${photo.id}`)

/** Uploads an official (immediately published) photo prepared by lib/image.js. */
/** Uploads an official photo, GIF or video (prepared by lib/mediaUpload.js), published immediately. */
export async function uploadOfficialMedia(prepared, { albumId, caption }) {
  return (await upload('/admin/photos', mediaFormData(prepared, { album_id: albumId, caption }))).photo
}
