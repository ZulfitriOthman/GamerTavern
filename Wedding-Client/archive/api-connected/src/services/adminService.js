// Admin API calls. Every endpoint requires the HttpOnly session cookie; every
// write also carries the session's CSRF token (see lib/api.js). Hiding the
// dashboard in the UI is never relied on for protection — the API enforces it.
import { api, setCsrfToken, upload } from '../lib/api.js'
import { mediaFormData, prepareImage, prepareMedia } from '../lib/media.js'

const arr = (v) => (Array.isArray(v) ? v : [])

// --- session -------------------------------------------------------------
export async function getSession() {
  const body = await api('GET', '/auth/session')
  setCsrfToken(body.csrfToken)
  return body.admin ?? null
}

export async function login(email, password) {
  const body = await api('POST', '/auth/login', { json: { email, password } })
  setCsrfToken(body.csrfToken)
  return body.admin
}

export async function logout() {
  try {
    await api('POST', '/auth/logout')
  } finally {
    setCsrfToken('')
  }
}

// --- overview & settings -------------------------------------------------
export const getStats = async () => (await api('GET', '/admin/stats')).stats
export const getSettings = async () => (await api('GET', '/admin/settings')).settings
export const saveSettings = async (settings) => (await api('PUT', '/admin/settings', { json: settings })).settings

/** Hero / story image → { url } (re-encoded server-side). */
export async function uploadSiteImage(file, onProgress) {
  const img = await prepareImage(file)
  const form = new FormData()
  form.append('image', img.blob, 'image.jpg')
  return upload('/admin/assets', form, onProgress)
}

// --- events --------------------------------------------------------------
export const listEvents = async () => arr((await api('GET', '/admin/events')).events)
export const saveEvent = async (id, event) => (await api(id ? 'PUT' : 'POST', id ? `/admin/events/${id}` : '/admin/events', { json: event })).event
export const deleteEvent = (id) => api('DELETE', `/admin/events/${id}`)

// --- guests & invitations -----------------------------------------------
export const listGuests = async () => arr((await api('GET', '/admin/guests')).guests)
/** → [{ id, name, token }] — tokens are shown once and never stored in plain text. */
export const createGuests = async (guests) => arr((await api('POST', '/admin/guests', { json: { guests } })).created)
export const updateGuest = (id, guest) => api('PUT', `/admin/guests/${id}`, { json: guest })
export const newInviteLink = async (id) => (await api('POST', `/admin/guests/${id}/invite-link`)).token
export const deleteGuest = (id) => api('DELETE', `/admin/guests/${id}`)

// --- RSVPs ---------------------------------------------------------------
export const listRsvps = async () => arr((await api('GET', '/admin/rsvps')).rsvps)
export const updateRsvp = (id, rsvp) => api('PUT', `/admin/rsvps/${id}`, { json: rsvp })
export const deleteRsvp = (id) => api('DELETE', `/admin/rsvps/${id}`)

// --- wishes --------------------------------------------------------------
export const listWishes = async (status = '') => arr((await api('GET', `/admin/greetings${status ? `?status=${status}` : ''}`)).greetings)
export const setWishStatus = (id, status) => api('PATCH', `/admin/greetings/${id}`, { json: { status } })
export const deleteWish = (id) => api('DELETE', `/admin/greetings/${id}`)

// --- albums & photos -----------------------------------------------------
export const listAlbums = async () => arr((await api('GET', '/admin/albums')).albums)
export const saveAlbum = async (id, album) => (await api(id ? 'PUT' : 'POST', id ? `/admin/albums/${id}` : '/admin/albums', { json: album })).album
export const deleteAlbum = (id) => api('DELETE', `/admin/albums/${id}`)

export const listPhotos = async (status = '') => arr((await api('GET', `/admin/photos${status ? `?status=${status}` : ''}`)).photos)
export const updatePhoto = (id, patch) => api('PATCH', `/admin/photos/${id}`, { json: patch })
export const deletePhoto = (id) => api('DELETE', `/admin/photos/${id}`)

export async function uploadOfficialPhoto(file, { albumId, caption }, onProgress) {
  const prepared = await prepareMedia(file)
  return (await upload('/admin/photos', mediaFormData(prepared, { album_id: albumId, caption }), onProgress)).photo
}
