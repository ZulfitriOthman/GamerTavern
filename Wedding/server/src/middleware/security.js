// CORS + security headers. Only origins listed in ALLOWED_ORIGINS may make
// credentialed cross-origin requests. State-changing requests from any other
// origin are rejected outright (defence in depth alongside SameSite cookies
// and the admin CSRF token).
import { config } from '../config.js'

function isAllowed(origin, req) {
  if (!origin) return true
  if (config.allowedOrigins.includes(origin)) return true
  return origin === `${req.protocol}://${req.get('host')}`
}

export function cors(req, res, next) {
  const origin = req.get('origin')
  const allowed = isAllowed(origin, req)
  if (origin && allowed) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.vary('Origin')
  }
  if (req.method === 'OPTIONS') {
    if (!allowed) return res.status(403).end()
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
    res.set('Access-Control-Max-Age', '600')
    return res.status(204).end()
  }
  if (!allowed && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ success: false, code: 'CORS_BLOCKED', message: 'Request origin not allowed.' })
  }
  next()
}

export function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('X-Frame-Options', 'DENY')
  res.removeHeader('X-Powered-By')
  next()
}

/** JSON API responses must never be cached by shared caches. */
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}
