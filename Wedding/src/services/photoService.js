import { api, ApiError, mediaUrl, requireArray, upload } from '../lib/api.js'
import { mediaFormData } from '../lib/mediaUpload.js'

/** Resolves the API's relative media paths (url, thumbUrl, posterUrl) to loadable URLs. */
export const withMediaUrls = (item) => ({
  ...item,
  media_type: item.media_type ?? 'image',
  url: mediaUrl(item.url),
  thumbUrl: item.thumbUrl ? mediaUrl(item.thumbUrl) : null,
  posterUrl: item.posterUrl ? mediaUrl(item.posterUrl) : null,
})

export async function listApprovedPhotos({ limit = 200 } = {}) {
  const body = await api('GET', `/public/photos?limit=${limit}`)
  return requireArray(body, 'photos', '/public/photos').map(withMediaUrls)
}

/**
 * Uploads one prepared photo, GIF or video (see lib/mediaUpload.js) with
 * progress. Resolves with the published gallery item only after the server
 * stored it AND the file is actually reachable at its public URL.
 */
export async function uploadGuestMedia(prepared, { name, caption, website }, onProgress) {
  const form = mediaFormData(prepared, { name, caption, consent: 'true', website: website ?? '' })
  const body = await upload('/public/photos', form, onProgress)
  if (body.status !== 'published' || !body.item?.url) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'The upload could not be confirmed. Please try again.')
  }
  const item = withMediaUrls(body.item)
  const check = await fetch(item.url, { method: 'HEAD', credentials: 'include', cache: 'no-store' }).catch(() => null)
  if (!check?.ok) throw new ApiError(check?.status ?? 0, 'NOT_ACCESSIBLE', 'Your file was received but is not viewable yet. Please try again.')
  return item
}
