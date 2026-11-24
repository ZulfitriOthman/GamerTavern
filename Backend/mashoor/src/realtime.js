// Live inspection updates for the Mashoor admin site and portal, on the host
// Backend's existing Socket.IO server (namespace /mashoor, the server's own
// transport path — /socket.io by default).
//
// Notify-only: every write and every check stays in the REST API. After a
// write has been committed and answered with a 2xx, authorised sockets get a
// minimal event ({ inspectionId, action, status, self }) and refetch through
// the same access-checked REST routes.
//
// Authentication: the session cookies are path-scoped to /api/mashoor/admin
// and /api/mashoor/portal, so they never reach the Socket.IO path. An
// authenticated (cookie + origin checked) POST .../realtime/ticket issues a
// single-use ticket valid for 30 seconds; the socket presents it in the
// handshake `auth`. The socket is then bound to that session and re-checked
// against the database before every delivery and on a periodic sweep, so a
// logout, expiry, password change, deactivated account or suspended company
// stops updates and disconnects the socket.
//
// Recipients are resolved on the server: staff sockets join `staff`, portal
// sockets join `company:<id>` from the account row (never from the client),
// and each portal socket is also checked with portalCanView — the REST rule —
// against the inspection before and after the change (so a reassigned
// inspector learns it is gone from their list).
import { randomBytes } from 'node:crypto'
import { findActiveStaff, findActiveVendor } from './auth/middleware.js'
import { getSession } from './auth/sessions.js'
import { getInspection, portalCanView } from './inspections.js'

export const MASHOOR_SOCKET_NAMESPACE = '/mashoor'
const TICKET_TTL_MS = 30_000
const SWEEP_MS = 30_000
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// /admin/inspections, /admin/inspections/12, /portal/inspections/12/submit, …/signoffs/checked_by
const INSPECTION_PATH = /^\/(admin|portal)\/inspections(?:\/(\d{1,15})(?:\/([a-z]+)(?:\/[a-z_]+)?)?)?\/?$/
// Staff changes that can alter what a company's portal accounts may see.
const COMPANY_PATH = /^\/admin\/vendors\/(\d{1,15})(?:\/|$)/
const VENDOR_USER_PATH = /^\/admin\/vendor-users\/(\d{1,15})(?:\/|$)/
const PORTAL_ACTIONS = { form: 'saved', submit: 'submitted', recheck: 'returned', verify: 'verified', signoffs: 'signed' }

export function createRealtime({ db, config }) {
  const tickets = new Map() // ticket -> { userType, token, expiresAt }
  const loadStaff = findActiveStaff(db)
  const loadVendor = findActiveVendor(db)
  let nsp = null
  let sweepTimer = null

  function pruneTickets(now = Date.now()) {
    for (const [ticket, entry] of tickets) if (entry.expiresAt <= now) tickets.delete(ticket)
  }

  function issueTicket(userType, token) {
    pruneTickets()
    const ticket = randomBytes(24).toString('base64url')
    tickets.set(ticket, { userType, token, expiresAt: Date.now() + TICKET_TTL_MS })
    return { ticket, expiresInMs: TICKET_TTL_MS, namespace: MASHOOR_SOCKET_NAMESPACE, path: nsp?.server.path() ?? '/socket.io' }
  }

  function redeemTicket(ticket) {
    if (typeof ticket !== 'string') return null
    const entry = tickets.get(ticket)
    if (!entry) return null
    tickets.delete(ticket) // single use, even when expired
    return entry.expiresAt > Date.now() ? entry : null
  }

  // Who the session belongs to right now, or null. Re-read from the database
  // every time, exactly like requireStaff / requireVendor.
  async function identify(userType, token) {
    const session = await getSession(db, userType, token)
    if (!session) return null
    if (userType === 'staff') {
      const staff = await loadStaff(session.userId)
      return staff && { type: 'staff', id: staff.id }
    }
    const vendor = await loadVendor(session.userId)
    return vendor && { type: 'vendor', ...vendor }
  }

  // Each live socket in a room, with its current identity; sockets whose
  // session no longer holds are disconnected and skipped.
  async function members(room) {
    const ids = nsp?.adapter.rooms.get(room)
    if (!ids) return []
    const list = []
    for (const socketId of [...ids]) {
      const socket = nsp.sockets.get(socketId)
      if (!socket) continue
      const who = await identify(socket.data.mashoor.userType, socket.data.mashoor.token)
      if (!who) {
        socket.disconnect(true)
        continue
      }
      list.push({ socket, who })
    }
    return list
  }

  async function sweep() {
    if (!nsp) return
    for (const socket of [...nsp.sockets.values()]) {
      const { userType, token } = socket.data.mashoor
      if (!(await identify(userType, token))) socket.disconnect(true)
    }
  }

  async function notifyInspection({ before, after, action, actor }) {
    if (!nsp) return
    const payload = { inspectionId: after.id, action, status: after.status }
    const isSelf = (who) => Boolean(actor) && actor.type === who.type && actor.id === who.id
    for (const { socket, who } of await members('staff')) socket.emit('inspection:changed', { ...payload, self: isSelf(who) })
    const companies = new Set([after.company_id, before?.company_id].filter(Boolean))
    for (const companyId of companies) {
      for (const { socket, who } of await members(`company:${companyId}`)) {
        const allowed = (await portalCanView(db, after, who)) || (before ? await portalCanView(db, before, who) : false)
        if (allowed) socket.emit('inspection:changed', { ...payload, self: isSelf(who) })
      }
    }
  }

  // Access settings changed for a company (sign-off stages, accounts, status):
  // its portal sockets and staff refetch; revoked sessions are dropped first.
  async function notifyCompany(companyId) {
    await sweep()
    if (!nsp) return
    for (const { socket } of await members(`company:${companyId}`)) socket.emit('access:changed', {})
    for (const { socket } of await members('staff')) socket.emit('access:changed', {})
  }

  // Express middleware (inside the Mashoor router): after a successful write,
  // once the response has been sent — every handler commits its transaction
  // before it answers — tell the affected sockets.
  function changeHook() {
    return async (req, res, next) => {
      if (SAFE_METHODS.has(req.method) || !nsp) return next()
      const path = req.path
      if (path.endsWith('/realtime/ticket') || path.endsWith('/auth/login')) return next()
      const match = INSPECTION_PATH.exec(path)
      let before = null
      try {
        before = match?.[2] ? await getInspection(db, Number(match[2])) : null
      } catch (error) {
        console.error('[mashoor-realtime] read before change failed:', error.message)
      }
      let body
      const json = res.json.bind(res)
      res.json = (value) => {
        body = value
        return json(value)
      }
      res.on('finish', async () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return
        try {
          if (match) {
            const id = match[2] ? Number(match[2]) : body?.inspection?.id
            const after = id && (await getInspection(db, id))
            if (!after) return
            let action = match[1] === 'admin' ? (match[2] ? 'updated' : 'created') : (PORTAL_ACTIONS[match[3]] ?? 'updated')
            if (action === 'signed' && after.status === 'approved' && before?.status !== 'approved') action = 'approved'
            const actor = req.staff ? { type: 'staff', id: req.staff.id } : req.vendor ? { type: 'vendor', id: req.vendor.id } : null
            await notifyInspection({ before, after, action, actor })
            return
          }
          const company = COMPANY_PATH.exec(path)
          const vendorUser = VENDOR_USER_PATH.exec(path)
          const companyId = company
            ? Number(company[1])
            : vendorUser
              ? (await db.prepare('SELECT company_id FROM mashoor_vendor_users WHERE id = ?').get(Number(vendorUser[1])))?.company_id
              : null
          if (companyId) await notifyCompany(companyId)
          else await sweep() // logout, password change, …: drop sockets whose session ended
        } catch (error) {
          console.error('[mashoor-realtime] notify failed:', error.message)
        }
      })
      next()
    }
  }

  // Registers the namespace on the host's Socket.IO server. Its io.use()
  // middleware and connection handlers belong to the default namespace and
  // are not involved.
  function attach(io) {
    if (nsp) throw new Error('Mashoor realtime is already attached.')
    const allowed = new Set(config.allowedOrigins)
    nsp = io.of(MASHOOR_SOCKET_NAMESPACE)
    nsp.use(async (socket, next) => {
      // Same rule as originCheck: an Origin, when sent, must be a Mashoor
      // frontend. (A same-origin polling handshake may carry no Origin; the
      // ticket can only be obtained by an origin-checked, cookie-authenticated POST.)
      const origin = socket.handshake.headers.origin
      if (origin && !allowed.has(origin)) return next(new Error('Origin not allowed.'))
      const entry = redeemTicket(socket.handshake.auth?.ticket)
      let who = null
      try {
        who = entry && (await identify(entry.userType, entry.token))
      } catch (error) {
        console.error('[mashoor-realtime] handshake check failed:', error.message)
      }
      if (!who) return next(new Error('Not signed in.'))
      socket.data.mashoor = {
        userType: entry.userType,
        token: entry.token,
        room: who.type === 'staff' ? 'staff' : `company:${who.companyId}`,
      }
      next()
    })
    nsp.on('connection', (socket) => {
      socket.join(socket.data.mashoor.room)
      socket.emit('ready', {})
    })
    sweepTimer = setInterval(() => {
      pruneTickets()
      sweep().catch((error) => console.error('[mashoor-realtime] sweep failed:', error.message))
    }, SWEEP_MS)
    sweepTimer.unref()
    return { namespace: MASHOOR_SOCKET_NAMESPACE, path: io.path() }
  }

  function close() {
    clearInterval(sweepTimer)
    if (nsp) {
      nsp.disconnectSockets(true)
      nsp.removeAllListeners()
    }
    tickets.clear()
  }

  return { issueTicket, changeHook, attach, close, sweep }
}
