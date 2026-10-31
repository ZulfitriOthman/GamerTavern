import { useState } from 'react'
import { mediaUrl } from '../../lib/api.js'

/**
 * Tries each source in order (an uploaded photo, then a local file from
 * src/config/images.js) and renders `fallback` when none loads — so a missing
 * placeholder file never shows a broken image.
 */
export function SmartImage({ sources, alt, fallback = null, className = '', ...props }) {
  const list = sources.filter(Boolean).map(mediaUrl)
  const key = list.join('|')
  const [failed, setFailed] = useState({ key, count: 0 })
  const count = failed.key === key ? failed.count : 0 // reset when the sources change
  const src = list[count]
  if (!src) return fallback
  return <img key={src} src={src} alt={alt} className={className} onError={() => setFailed({ key, count: count + 1 })} {...props} />
}
