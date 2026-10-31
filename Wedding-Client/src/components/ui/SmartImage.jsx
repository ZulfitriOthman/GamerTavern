import { useState } from 'react'
import { imageUrl } from '../../lib/images.js'

/**
 * Shows the photo named in weddingData.js (a file in src/assets/wedding/), or
 * `fallback` when that file hasn't been added yet — or fails to load — so a
 * photo slot never appears as a broken image.
 */
export function SmartImage({ src, alt, fallback = null, className = '', ...props }) {
  const url = imageUrl(src)
  const [failed, setFailed] = useState(null) // the URL that failed to load
  if (!url || failed === url) return fallback
  return <img key={url} src={url} alt={alt} className={className} onError={() => setFailed(url)} {...props} />
}
