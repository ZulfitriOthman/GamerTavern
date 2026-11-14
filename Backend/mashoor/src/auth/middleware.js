import { getSession, readCookie, STAFF_COOKIE, VENDOR_COOKIE } from './sessions.js'

const UNAUTHENTICATED = { error: 'Not signed in.' }

// Staff-only gate for every /api/mashoor/admin route except login/logout.
export function requireStaff(db) {
  const findStaff = db.prepare('SELECT id, email, name, role FROM staff_users WHERE id = ? AND active = 1')
  return (req, res, next) => {
    const token = readCookie(req, STAFF_COOKIE.name)
    const session = getSession(db, 'staff', token)
    const staff = session && findStaff.get(session.userId)
    if (!staff) return res.status(401).json(UNAUTHENTICATED)
    req.staff = staff
    req.sessionToken = token
    next()
  }
}

// Vendor gate. The company is always taken from the account in the database,
// never from the request, and is re-checked on every request so deactivating a
// user or suspending a company takes effect immediately.
export function requireVendor(db) {
  const findVendor = db.prepare(
    `SELECT vu.id, vu.username, vu.name, vu.role, c.id AS company_id, c.name AS company_name
       FROM vendor_users vu
       JOIN vendor_companies c ON c.id = vu.company_id
      WHERE vu.id = ? AND vu.active = 1 AND c.status = 'active'`,
  )
  return (req, res, next) => {
    const token = readCookie(req, VENDOR_COOKIE.name)
    const session = getSession(db, 'vendor', token)
    const row = session && findVendor.get(session.userId)
    if (!row) return res.status(401).json(UNAUTHENTICATED)
    req.vendor = {
      id: row.id,
      username: row.username,
      role: row.role,
      name: row.name,
      companyId: row.company_id,
      companyName: row.company_name,
    }
    req.sessionToken = token
    next()
  }
}

// After requireVendor: only accounts with one of the given roles (client /
// inspector) may continue. The role is re-read from the database on every
// request, so a role change by staff applies immediately.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.vendor.role)) return res.status(403).json({ error: 'Your account does not have access to this.' })
    next()
  }
}

// CSRF defence in depth on top of SameSite=Strict cookies: browsers always send
// Origin on cross-site state-changing requests, so reject unknown origins.
export function originCheck(allowedOrigins) {
  const allowed = new Set(allowedOrigins)
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const origin = req.headers.origin
    if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Origin not allowed.' })
    next()
  }
}
