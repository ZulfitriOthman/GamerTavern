// Admin authentication: bcrypt password hashes, server-side sessions in
// MySQL, HttpOnly cookie, per-session CSRF token, login rate limiting.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from '../config.js'
import { randomToken, safeEqual, sha256 } from '../lib/crypto.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { email as validEmail } from '../lib/validate.js'
import { enforce } from './rateLimit.js'

// Compared against when the email is unknown, so response time does not
// reveal which admin emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)

export async function login(db, { email, password }, { ip, userAgent }) {
  const addr = validEmail(email)
  if (!addr || typeof password !== 'string' || password.length === 0 || password.length > 200) {
    throw unauthorized('Incorrect email or password.')
  }
  const tooMany = 'Too many sign-in attempts. Please wait 15 minutes and try again.'
  await enforce(db, [['login-ip', ip, 10, 900], ['login-email', addr, 5, 900]], tooMany)

  const [rows] = await db.query('SELECT id, email, display_name, password_hash, is_active FROM wedding_admins WHERE email = ?', [addr])
  const admin = rows[0]
  const ok = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH)
  if (!admin || !ok || !admin.is_active) throw unauthorized('Incorrect email or password.')

  const token = randomToken(32) // cookie value; only its hash is stored
  const csrf = crypto.randomBytes(32).toString('hex') // returned to the admin UI, sent back in X-CSRF-Token
  await db.query(
    `INSERT INTO wedding_admin_sessions (id, admin_id, csrf_token, expires_at, user_agent)
     VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? HOUR, ?)`,
    [sha256(token), admin.id, csrf, config.session.ttlHours, userAgent?.slice(0, 255) ?? null],
  )
  await db.query('UPDATE wedding_admins SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [admin.id])
  return { token, csrf, admin: { id: admin.id, email: admin.email, displayName: admin.display_name } }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.session.secureCookie,
    sameSite: config.session.sameSite,
    path: '/api/wedding', // only sent to wedding routes, not the rest of a shared backend
    maxAge: config.session.ttlHours * 3600 * 1000,
  }
}

/** Looks up the session from the cookie. Returns null if absent/expired. */
export async function loadSession(db, req) {
  const token = req.cookies?.[config.session.cookieName]
  if (!token || typeof token !== 'string' || token.length > 100) return null
  const [rows] = await db.query(
    `SELECT s.id AS session_id, s.csrf_token, a.id, a.email, a.display_name
       FROM wedding_admin_sessions s
       JOIN wedding_admins a ON a.id = s.admin_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP() AND a.is_active = 1`,
    [sha256(token)],
  )
  return rows[0] ?? null
}

export async function logout(db, req) {
  const token = req.cookies?.[config.session.cookieName]
  if (token) await db.query('DELETE FROM wedding_admin_sessions WHERE id = ?', [sha256(String(token))])
}

/** Middleware: require a valid admin session; require the CSRF header on writes. */
export function requireAdmin(db) {
  return async (req, _res, next) => {
    const session = await loadSession(db, req)
    if (!session) throw unauthorized()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !safeEqual(req.get('x-csrf-token'), session.csrf_token)) {
      throw forbidden('Your session has expired. Please refresh the page.')
    }
    req.admin = { id: session.id, email: session.email, displayName: session.display_name, csrf: session.csrf_token }
    db.query('UPDATE wedding_admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?', [session.session_id]).catch(() => {})
    next()
  }
}

/**
 * Password rules for admin accounts. bcrypt only uses the first 72 BYTES of a
 * password (and login() rejects anything longer than 200 characters), so longer
 * passwords are refused rather than silently truncated. Returns an error message or null.
 */
export function adminPasswordProblem(password) {
  if (typeof password !== 'string' || password.length < 12) return 'Password must be at least 12 characters.'
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes (about 72 plain characters; fewer with emoji or accents).'
  if (password.trim() !== password) return 'Password must not start or end with a space.'
  return null
}

export const hashAdminPassword = (password) => bcrypt.hash(password, config.bcryptRounds)

/** Creates an admin. Only reachable from the local CLI (scripts/create-admin.js) — no HTTP route. */
export async function createAdmin(db, { email, password, displayName }) {
  const addr = validEmail(email)
  if (!addr) throw new Error('A valid email is required.')
  const problem = adminPasswordProblem(password)
  if (problem) throw new Error(problem)
  const hash = await hashAdminPassword(password)
  const id = crypto.randomUUID() // 122 random bits; admin IDs need no time ordering
  await db.query('INSERT INTO wedding_admins (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)', [id, addr, displayName || null, hash])
  return id
}
