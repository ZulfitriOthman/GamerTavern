import { createHash, randomBytes } from 'node:crypto'
import { MASHOOR_API_PREFIX } from '../config.js'

// Cookies are scoped by both name and path, so the browser never sends a vendor
// cookie to admin routes (or vice versa). Lookups also filter on user_type, so a
// token copied into the wrong cookie is still rejected.
export const STAFF_COOKIE = { name: 'mashoor_staff', path: `${MASHOOR_API_PREFIX}/admin` }
export const VENDOR_COOKIE = { name: 'mashoor_vendor', path: `${MASHOOR_API_PREFIX}/portal` }

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

export function createSession(db, userType, userId, ttlMs) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  db.prepare(
    'INSERT INTO sessions (token_hash, user_type, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(hashToken(token), userType, userId, now, now + ttlMs)
  return token
}

export function getSession(db, userType, token) {
  if (!token) return null
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND user_type = ?')
    .get(hashToken(token), userType)
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    deleteSession(db, token)
    return null
  }
  return { userId: row.user_id }
}

export function deleteSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function deleteUserSessions(db, userType, userId, { exceptToken } = {}) {
  db.prepare('DELETE FROM sessions WHERE user_type = ? AND user_id = ? AND token_hash <> ?').run(
    userType,
    userId,
    exceptToken ? hashToken(exceptToken) : '',
  )
}

export function deleteCompanySessions(db, companyId) {
  db.prepare(
    `DELETE FROM sessions WHERE user_type = 'vendor'
       AND user_id IN (SELECT id FROM vendor_users WHERE company_id = ?)`,
  ).run(companyId)
}

export function deleteExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}

export function readCookie(req, name) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}

export function setSessionCookie(res, cookie, token, config) {
  res.cookie(cookie.name, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: cookie.path,
    maxAge: config.sessionTtlMs,
  })
}

export function clearSessionCookie(res, cookie, config) {
  res.clearCookie(cookie.name, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: cookie.path })
}
