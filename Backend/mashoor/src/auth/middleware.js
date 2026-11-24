import { getSession, readCookie, STAFF_COOKIE, VENDOR_COOKIE } from './sessions.js'

const UNAUTHENTICATED = { error: 'Not signed in.' }

// Active staff account by id, or null. Shared with the realtime socket checks.
export function findActiveStaff(db) {
  const findStaff = db.prepare('SELECT id, username, email, name, role FROM mashoor_staff_users WHERE id = ? AND active = 1')
  return async (userId) => (await findStaff.get(userId)) ?? null
}

// Active portal account (in an active company) by id, as req.vendor, or null.
// Shared with the realtime socket checks.
export function findActiveVendor(db) {
  const findVendor = db.prepare(
    `SELECT vu.id, vu.username, vu.name, vu.role, c.id AS company_id, c.name AS company_name
       FROM mashoor_vendor_users vu
       JOIN mashoor_vendor_companies c ON c.id = vu.company_id
      WHERE vu.id = ? AND vu.active = 1 AND c.status = 'active'`,
  )
  return async (userId) => {
    const row = await findVendor.get(userId)
    if (!row) return null
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      name: row.name,
      companyId: row.company_id,
      companyName: row.company_name,
    }
  }
}

// Staff-only gate for every /api/mashoor/admin route except login/logout.
export function requireStaff(db) {
  const findStaff = findActiveStaff(db)
  return async (req, res, next) => {
    const token = readCookie(req, STAFF_COOKIE.name)
    const session = await getSession(db, 'staff', token)
    const staff = session && (await findStaff(session.userId))
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
  const findVendor = findActiveVendor(db)
  return async (req, res, next) => {
    const token = readCookie(req, VENDOR_COOKIE.name)
    const session = await getSession(db, 'vendor', token)
    const vendor = session && (await findVendor(session.userId))
    if (!vendor) return res.status(401).json(UNAUTHENTICATED)
    req.vendor = vendor
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
