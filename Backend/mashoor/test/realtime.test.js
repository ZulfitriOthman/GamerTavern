// Live inspection updates (src/realtime.js) on a real Socket.IO server, as
// Backend/server.js wires it: ticket authentication, server-side recipients
// (staff, organisation, assignment, signatories), and revoked sessions.
// The socket client speaks the Socket.IO v4 wire protocol over Node's
// built-in WebSocket, so the Backend needs no client dependency.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { Server } from 'socket.io'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createRealtime } from '../src/realtime.js'
import { APP_ORIGIN, Client, createTestDatabase, insertStaff, PORTAL_APP_ORIGIN } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const PW = 'Account-Pass-2026'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const definition = {
  header: { companyName: 'TEST CO', title: 'TEST CHECKLIST', subtitle: '', showLogos: false },
  details: [{ key: 'date', default: '', required: false }],
  statusLegend: [
    { value: 'A', label: 'Option One' },
    { value: 'B', label: 'Option Two' },
  ],
  sections: [{ key: 's1', number: '1.', title: 'Section 1', column: 1, items: [{ key: 'a', number: '1.1', label: 'item A' }] }],
  footer: { remarks: true, nextServicing: false },
  damage: { enabled: false },
}

// Minimal Socket.IO v4 client for namespace /mashoor.
class LiveSocket {
  static async open(port, ticket, { origin = PORTAL_APP_ORIGIN } = {}) {
    const s = new LiveSocket()
    s.ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: { origin } })
    s.events = []
    s.closed = false
    s.result = new Promise((resolve) => {
      s.ws.addEventListener('message', ({ data }) => {
        if (data === '2') return s.ws.send('3') // ping → pong
        if (data.startsWith('0')) return s.ws.send(`40/mashoor,${JSON.stringify({ ticket })}`)
        if (data.startsWith('40/mashoor,')) return resolve({ ok: true })
        if (data.startsWith('44/mashoor,')) return resolve({ ok: false, error: JSON.parse(data.slice(11)).message })
        if (data.startsWith('41/mashoor')) s.closed = true
        if (data.startsWith('42/mashoor,')) s.events.push(JSON.parse(data.slice(11)))
      })
      s.ws.addEventListener('close', () => {
        s.closed = true
        resolve({ ok: false, error: 'closed' })
      })
    })
    return s
  }
  changes() {
    return this.events.filter(([name]) => name === 'inspection:changed').map(([, payload]) => payload)
  }
  close() {
    this.ws.close()
  }
}

describe('live inspection updates (Socket.IO /mashoor)', () => {
  let http
  let io
  let realtime
  let db
  let testDb
  let port
  let base
  let staff
  const ids = {}
  const as = {}
  const sockets = []

  const adm = (method, path, body) => staff.request(method, `/api/mashoor/admin${path}`, { body, headers: { origin: APP_ORIGIN } })
  const api = (who, method, path, body) => as[who].request(method, `/api/mashoor/portal${path}`, { body, headers: { origin: PORTAL_APP_ORIGIN } })
  async function account(companyId, username, name, role = 'client') {
    const res = await adm('POST', `/vendors/${companyId}/users`, { name, username, password: PW, role })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const c = new Client(base)
    assert.equal((await c.post('/api/mashoor/portal/auth/login', { username, password: PW })).status, 200)
    as[username] = c
    return res.body.user.id
  }
  async function connect(who) {
    const res =
      who === 'staff'
        ? await adm('POST', '/realtime/ticket')
        : await api(who, 'POST', '/realtime/ticket')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.namespace, '/mashoor')
    const socket = await LiveSocket.open(port, res.body.ticket, { origin: who === 'staff' ? APP_ORIGIN : PORTAL_APP_ORIGIN })
    sockets.push(socket)
    assert.deepEqual(await socket.result, { ok: true }, who)
    return socket
  }
  const reset = (...list) => list.forEach((s) => (s.events.length = 0))

  before(async () => {
    testDb = await createTestDatabase()
    db = await testDb.open({ importChecklists: false })
    const config = {
      ...loadConfig({}),
      mysql: testDb.mysqlConfig,
      storageDir: mkdtempSync(join(tmpdir(), 'mashoor-test-')),
      allowedOrigins: [APP_ORIGIN, PORTAL_APP_ORIGIN],
      cookieSecure: false,
    }
    realtime = createRealtime({ db, config })
    http = createServer(createApp({ db, config, realtime }))
    io = new Server(http)
    realtime.attach(io)
    await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
    port = http.address().port
    base = `http://127.0.0.1:${port}`

    await insertStaff(db, { ...STAFF, name: 'Staff' })
    staff = new Client(base)
    await staff.post('/api/mashoor/admin/auth/login', STAFF)
    ids.companyA = (await adm('POST', '/vendors', { name: 'Company A' })).body.vendor.id
    ids.companyB = (await adm('POST', '/vendors', { name: 'Company B' })).body.vendor.id
    ids.insp = await account(ids.companyA, 'insp', 'Ian Inspector', 'inspector')
    ids.insp2 = await account(ids.companyA, 'insp2', 'Ina Inspector', 'inspector')
    ids.cli = await account(ids.companyA, 'cli', 'Cara Client')
    ids.checker = await account(ids.companyA, 'checker', 'Chad Checker', 'inspector')
    ids.clib = await account(ids.companyB, 'clib', 'Bea Client')
    await account(ids.companyB, 'inspb', 'Ben Inspector', 'inspector')
    const t = await adm('POST', '/checklist-templates', { vehicleType: 'FORKLIFT', name: 'Live test', definition })
    assert.equal((await adm('POST', `/checklist-templates/${t.body.template.id}/publish`)).status, 200)
    ids.template = t.body.template.id
  })

  after(async () => {
    for (const s of sockets) s.close()
    realtime.close()
    io.close()
    http.closeAllConnections()
    await db.close()
    await testDb.drop()
  })

  it('issues tickets only to signed-in sessions from an allowed origin', async () => {
    const anon = new Client(base)
    assert.equal((await anon.request('POST', '/api/mashoor/portal/realtime/ticket', { headers: { origin: PORTAL_APP_ORIGIN } })).status, 401)
    assert.equal((await anon.request('POST', '/api/mashoor/admin/realtime/ticket', { headers: { origin: APP_ORIGIN } })).status, 401)
    const foreign = await as.cli.request('POST', '/api/mashoor/portal/realtime/ticket', { headers: { origin: 'https://evil.example' } })
    assert.equal(foreign.status, 403)
  })

  it('rejects a missing, reused or foreign-origin handshake', async () => {
    const none = await LiveSocket.open(port, undefined)
    sockets.push(none)
    assert.deepEqual(await none.result, { ok: false, error: 'Not signed in.' })

    const { ticket } = (await api('cli', 'POST', '/realtime/ticket')).body
    const first = await LiveSocket.open(port, ticket)
    sockets.push(first)
    assert.deepEqual(await first.result, { ok: true })
    const reused = await LiveSocket.open(port, ticket)
    sockets.push(reused)
    assert.deepEqual(await reused.result, { ok: false, error: 'Not signed in.' }, 'tickets are single-use')

    const other = (await api('cli', 'POST', '/realtime/ticket')).body.ticket
    const evil = await LiveSocket.open(port, other, { origin: 'https://evil.example' })
    sockets.push(evil)
    assert.deepEqual(await evil.result, { ok: false, error: 'Origin not allowed.' })
    first.close()
  })

  it('sends creation, submission, re-check and sign-off only to authorised accounts', async () => {
    const s = {
      staff: await connect('staff'),
      insp: await connect('insp'),
      insp2: await connect('insp2'),
      cli: await connect('cli'),
      checker: await connect('checker'),
      clib: await connect('clib'),
      inspb: await connect('inspb'),
    }
    const all = Object.values(s)
    const got = (socket) => socket.changes().map((c) => c.action)

    // Create: staff, the assigned inspector and the client; not the other inspector or company B.
    const created = await adm('POST', '/inspections', { companyId: ids.companyA, inspectorId: ids.insp, templateId: ids.template, vehiclePlate: 'LIVE 1' })
    assert.equal(created.status, 201)
    const id = created.body.inspection.id
    await wait(150)
    assert.deepEqual(got(s.staff), ['created'])
    assert.deepEqual(s.staff.changes()[0], { inspectionId: id, action: 'created', status: 'assigned', self: true })
    assert.deepEqual(got(s.insp), ['created'])
    assert.equal(s.insp.changes()[0].self, false)
    assert.deepEqual(got(s.cli), ['created'])
    assert.deepEqual(got(s.insp2), [], 'not assigned')
    assert.deepEqual(got(s.checker), [], 'no sign-off stage yet')
    assert.deepEqual(got(s.clib), [], 'other organisation')
    assert.deepEqual(got(s.inspb), [], 'other organisation')

    // Reassign: the old inspector is told (the item left their list), and the new one.
    reset(...all)
    assert.equal((await adm('PATCH', `/inspections/${id}`, { inspectorId: ids.insp2 })).status, 200)
    await wait(150)
    assert.deepEqual(got(s.insp), ['updated'])
    assert.deepEqual(got(s.insp2), ['updated'])
    assert.deepEqual(got(s.clib), [])
    assert.equal((await adm('PATCH', `/inspections/${id}`, { inspectorId: ids.insp })).status, 200)
    await wait(150)

    // Submit (incomplete is refused and sends nothing), then a complete submission.
    reset(...all)
    assert.equal((await api('insp', 'POST', `/inspections/${id}/submit`, { answers: { items: {} } })).status, 400)
    await wait(100)
    assert.deepEqual(got(s.staff), [], 'a refused write emits nothing')
    const sub = await api('insp', 'POST', `/inspections/${id}/submit`, { answers: { items: { a: { status: 'A', remark: '', action: '' } } } })
    assert.equal(sub.status, 200, JSON.stringify(sub.body))
    await wait(150)
    assert.deepEqual(s.cli.changes(), [{ inspectionId: id, action: 'submitted', status: 'pending_verification', self: false }])
    assert.equal(s.insp.changes()[0].self, true)
    assert.deepEqual(got(s.staff), ['submitted'])
    assert.deepEqual(got(s.clib), [])
    assert.deepEqual(got(s.inspb), [])

    // Re-check.
    reset(...all)
    assert.equal((await api('cli', 'POST', `/inspections/${id}/recheck`, { revision: 1, reason: 'Please re-check tyres.' })).status, 200)
    await wait(150)
    assert.deepEqual(got(s.insp), ['returned'])
    assert.deepEqual(got(s.staff), ['returned'])
    assert.deepEqual(got(s.clib), [])

    // Sign-off stage assigned → the checker now sees company inspections.
    reset(...all)
    const settings = await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, { signatories: { checked_by: ids.checker, agreed_by: ids.cli, approved_by: ids.checker } })
    assert.equal(settings.status, 200, JSON.stringify(settings.body))
    await wait(150)
    assert.ok(s.checker.events.some(([name]) => name === 'access:changed'))
    assert.ok(!s.clib.events.some(([name]) => name === 'access:changed'), 'other organisation')

    const resub = await api('insp', 'POST', `/inspections/${id}/submit`, { answers: { items: { a: { status: 'A', remark: '', action: '' } } } })
    assert.equal(resub.status, 200)
    await wait(150)
    reset(...all)
    const signed = await api('checker', 'POST', `/inspections/${id}/signoffs/checked_by`, { revision: 2, fullName: 'Chad Checker' })
    assert.equal(signed.status, 200, JSON.stringify(signed.body))
    await wait(150)
    assert.deepEqual(got(s.checker), ['signed'])
    assert.deepEqual(got(s.cli), ['signed'])
    assert.deepEqual(got(s.staff), ['signed'])
    assert.deepEqual(got(s.clib), [])
    assert.deepEqual(got(s.inspb), [])

    // Verification, Agreed by, then Approved by → 'approved' for everyone authorised.
    assert.equal((await api('cli', 'POST', `/inspections/${id}/verify`, { revision: 2 })).status, 200)
    assert.equal((await api('cli', 'POST', `/inspections/${id}/signoffs/agreed_by`, { revision: 2, fullName: 'Cara Client' })).status, 200)
    await wait(150)
    reset(...all)
    const approved = await api('checker', 'POST', `/inspections/${id}/signoffs/approved_by`, { revision: 2, fullName: 'Chad Checker' })
    assert.equal(approved.status, 200, JSON.stringify(approved.body))
    await wait(150)
    assert.deepEqual(s.insp.changes(), [{ inspectionId: id, action: 'approved', status: 'approved', self: false }])
    assert.deepEqual(got(s.staff), ['approved'])
    assert.deepEqual(got(s.cli), ['approved'])
    assert.deepEqual(got(s.clib), [])
    assert.deepEqual(got(s.inspb), [])
  })

  it('serialises concurrent workflow steps on one inspection (row lock)', async () => {
    const answers = { items: { a: { status: 'A', remark: '', action: '' } } }
    const created = await adm('POST', '/inspections', { companyId: ids.companyA, inspectorId: ids.insp, templateId: ids.template, vehiclePlate: 'RACE 1' })
    const id = created.body.inspection.id
    // Two submissions at once: one revision, one refusal.
    const subs = await Promise.all([1, 2].map(() => api('insp', 'POST', `/inspections/${id}/submit`, { answers })))
    assert.deepEqual(subs.map((r) => r.status).sort(), [200, 409])
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM mashoor_inspection_revisions WHERE inspection_id = ?').get(id)).n, 1)
    // Verify and re-check of the same revision at once: exactly one decision.
    const [verify, recheck] = await Promise.all([
      api('cli', 'POST', `/inspections/${id}/verify`, { revision: 1 }),
      api('cli', 'POST', `/inspections/${id}/recheck`, { revision: 1, reason: 'Concurrent re-check' }),
    ])
    assert.deepEqual([verify.status, recheck.status].sort(), [200, 409])
    const status = (await db.prepare('SELECT status FROM mashoor_inspections WHERE id = ?').get(id)).status
    assert.equal(status, verify.status === 200 ? 'pending_approval' : 'returned')
    // The same stage confirmed twice at once: one sign-off row.
    if (verify.status !== 200) {
      assert.equal((await api('insp', 'POST', `/inspections/${id}/submit`, { answers })).status, 200)
    }
    const revision = (await db.prepare('SELECT current_revision AS r FROM mashoor_inspections WHERE id = ?').get(id)).r
    const signs = await Promise.all([1, 2].map(() => api('checker', 'POST', `/inspections/${id}/signoffs/checked_by`, { revision, fullName: 'Chad Checker' })))
    assert.deepEqual(signs.map((r) => r.status).sort(), [200, 409])
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM mashoor_inspection_signoffs s JOIN mashoor_inspection_revisions r ON r.id = s.revision_id WHERE r.inspection_id = ? AND s.stage = 'checked_by'")
      .get(id)
    assert.equal(rows.n, 1)
  })

  it('disconnects sockets whose session ends (logout, deactivation)', async () => {
    const cli = await connect('cli')
    assert.equal((await api('cli', 'POST', '/auth/logout')).status, 204)
    await wait(150)
    assert.equal(cli.closed, true, 'logout ends the socket')

    const insp2 = await connect('insp2')
    assert.equal((await adm('PATCH', `/vendor-users/${ids.insp2}`, { active: false })).status, 200)
    await wait(150)
    assert.equal(insp2.closed, true, 'deactivated account is disconnected')

    // A socket left behind by an ended session never receives later updates.
    const checker = await connect('checker')
    await db.prepare("DELETE FROM mashoor_sessions WHERE user_type = 'vendor' AND user_id = ?").run(ids.checker)
    await adm('POST', '/inspections', { companyId: ids.companyA, inspectorId: ids.insp, templateId: ids.template, vehiclePlate: 'LIVE 2' })
    await wait(150)
    assert.deepEqual(checker.changes(), [])
    assert.equal(checker.closed, true)
  })

  it('disconnects every live socket of a removed organisation, and only those', async () => {
    const companyC = (await adm('POST', '/vendors', { name: 'Company C (to remove)' })).body.vendor.id
    await account(companyC, 'clic', 'Cy Client')
    await account(companyC, 'inspc', 'Cy Inspector', 'inspector')
    const clic = await connect('clic')
    const inspc = await connect('inspc')
    const clib = await connect('clib')
    const staffSocket = await connect('staff')
    reset(staffSocket)

    assert.equal((await adm('POST', `/vendors/${companyC}/remove`)).status, 200)
    await wait(150)
    assert.equal(clic.closed, true, 'client of the removed organisation')
    assert.equal(inspc.closed, true, 'inspector of the removed organisation')
    assert.equal(clib.closed, false, 'another organisation stays connected')
    assert.equal(staffSocket.closed, false)
    assert.ok(staffSocket.events.some(([name]) => name === 'access:changed'), 'staff lists refetch')
    // A new ticket is refused for the removed organisation's (ended) sessions.
    assert.equal((await api('clic', 'POST', '/realtime/ticket')).status, 401)
  })
})
