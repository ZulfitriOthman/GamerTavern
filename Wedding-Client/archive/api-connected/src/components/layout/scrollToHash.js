/** Smoothly scrolls to `#id` (instantly for reduced-motion visitors). Returns false if it isn't on the page yet. */
export function scrollToHash(hash) {
  const id = decodeURIComponent(String(hash || '').replace(/^#/, ''))
  const el = id && document.getElementById(id)
  if (!el) return false
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  return true
}
