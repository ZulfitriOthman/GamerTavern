// Return-to handling after sign-in. A return path is only ever an internal
// path of this app ("/x?y#z"): anything absolute, protocol-relative ("//host"),
// containing backslashes or control characters, or not on the caller's
// allowlist is dropped, so the login page can never send someone off-site.

const BASE = 'http://return.invalid'

// Normalizes a candidate to "/path?query#hash", or returns null if unsafe.
export function toInternalPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  let url
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  return url.pathname + url.search + url.hash
}

// `isAllowed(pathname)` decides which app routes may be returned to.
export function safeReturnPath(value, { isAllowed = () => true, fallback = '/' } = {}) {
  const path = toInternalPath(value)
  if (!path) return fallback
  const pathname = path.split(/[?#]/, 1)[0]
  if (pathname === '/login' || !isAllowed(pathname)) return fallback
  return path
}
