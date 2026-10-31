import { api, ApiError, requireArray } from '../lib/api.js'

/**
 * Loads public site settings, published events and public albums.
 * `events` / `albums` must be arrays (possibly empty). `settings` may be null —
 * that is valid and means the settings row has not been seeded yet.
 */
export async function loadPublicSite() {
  const body = await api('GET', '/public/site')
  const settings = body.settings ?? null
  if (settings !== null && (typeof settings !== 'object' || Array.isArray(settings))) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'The website could not reach its server. Please try again in a moment.')
  }
  return {
    settings,
    events: requireArray(body, 'events', '/public/site'),
    albums: requireArray(body, 'albums', '/public/site'),
  }
}
