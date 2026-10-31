import { api, ApiError, requireArray } from '../lib/api.js'

/**
 * Newest published wishes. `limit` (optional) asks the server for just that
 * many; the result is also trimmed here so older backends that ignore the
 * parameter can't return more than requested.
 */
export async function listApprovedGreetings(page = 0, { limit } = {}) {
  const query = new URLSearchParams({ page: String(page) })
  if (limit) query.set('limit', String(limit))
  const body = await api('GET', `/public/greetings?${query}`)
  const items = requireArray(body, 'items', '/public/greetings')
  return { items: limit ? items.slice(0, limit) : items, hasMore: body.hasMore === true }
}

/**
 * Publishes a wish (no approval step). Resolves with { status: 'published', item }
 * once the server has saved it, or { status: 'duplicate' }. Throws on
 * validation / rate-limit errors and on any response that doesn't confirm the save.
 */
export async function submitGreeting({ name, message, relationship, website }) {
  const body = await api('POST', '/public/greetings', { json: { name, message, relationship, website } })
  if (body.status === 'duplicate') return { status: 'duplicate' }
  if (body.status !== 'published' || !body.item?.id) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'Your wish could not be confirmed. Please try again.')
  }
  return { status: 'published', item: body.item }
}
