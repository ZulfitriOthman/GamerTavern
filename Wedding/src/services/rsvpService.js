import { api } from '../lib/api.js'

/** Returns the invitation for a personal link, or null if the link is not valid. */
export async function getInvitation(token) {
  try {
    const { invitation } = await api('GET', `/public/invitations/${encodeURIComponent(token)}`)
    return invitation
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

/** Returns { status: 'saved' | 'duplicate', events }. */
export async function submitRsvp({ token, name, email, phone, message, responses, website }) {
  return api('POST', '/public/rsvps', { json: { token: token || null, name, email, phone, message, responses, website } })
}
