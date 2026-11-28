// Organisation removal (Admin → Vendors → Remove) over real HTTP sessions, on
// a throwaway test database. Company A gets a full inspection history (revision,
// sign-off, client verification, events) and then is removed; Company B is an
// unrelated organisation that must not be affected.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { APP_ORIGIN, Client, insertStaff, startTestServer } from './helpers.js'

const STAFF = { email: 'remover@mashoor.test', password: 'StaffPass123!' }
const OTHER_STAFF = { email: 'other@mashoor.test', password: 'OtherPass123!' }
const PW = 'Account-Pass-2026'

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

describe('organisation removal', () => {
  let server
  let staff
  const ids = {}
  const as = {} // portal username → signed-in Client

  const adm = (method, path, body, opts) => staff.request(method, `/api/mashoor/admin${path}`, { body, ...opts })
  const portal = (username, method, path, body) => as[username].request(method, `/api/mashoor/portal${path}`, { body })
  const remove = (client, id, opts) => client.request('POST', `/api/mashoor/admin/vendors/${id}/remove`, opts)
  const count = async (sql, ...params) => Number((await server.db.prepare(sql).get(...params)).n)

  async function account(companyId, username, name, role = 'client') {
    const res = await adm('POST', `/vendors/${companyId}/users`, { name, username, password: PW, role })
    assert.equal(res.status, 201, `${username}: ${JSON.stringify(res.body)}`)
    return res.body.user.id
  }
  async function signIn(username) {
    const c = new Client(server.baseUrl)
    const res = await c.post('/api/mashoor/portal/auth/login', { username, password: PW })
    as[username] = c
    return res.status
  }
  // Every history row that references Company A (directly or via its inspections).
  const historyOf = async (companyId) => ({
    inspections: await count('SELECT COUNT(*) AS n FROM mashoor_inspections WHERE company_id = ?', companyId),
    revisions: await count(
      'SELECT COUNT(*) AS n FROM mashoor_inspection_revisions r JOIN mashoor_inspections i ON i.id = r.inspection_id WHERE i.company_id = ?',
      companyId,
    ),
    signoffs: await count(
      `SELECT COUNT(*) AS n FROM mashoor_inspection_signoffs s JOIN mashoor_inspection_revisions r ON r.id = s.revision_id
         JOIN mashoor_inspections i ON i.id = r.inspection_id WHERE i.company_id = ?`,
      companyId,
    ),
    events: await count(
      'SELECT COUNT(*) AS n FROM mashoor_inspection_events e JOIN mashoor_inspections i ON i.id = e.inspection_id WHERE i.company_id = ?',
      companyId,
    ),
    signatories: await count('SELECT COUNT(*) AS n FROM mashoor_inspection_signatories WHERE company_id = ?', companyId),
    accounts: await count('SELECT COUNT(*) AS n FROM mashoor_vendor_users WHERE company_id = ?', companyId),
  })
  const sessionsOf = (companyId) =>
    count(
      `SELECT COUNT(*) AS n FROM mashoor_sessions s JOIN mashoor_vendor_users u ON u.id = s.user_id
        WHERE s.user_type = 'vendor' AND u.company_id = ?`,
      companyId,
    )
  let historyBefore

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Rita Remover' })
    await insertStaff(server.db, { ...OTHER_STAFF, name: 'Other Staff' })
    staff = new Client(server.baseUrl)
    assert.equal((await staff.post('/api/mashoor/admin/auth/login', STAFF)).status, 200)
    ids.staff = (await adm('GET', '/auth/me')).body.user.id

    ids.companyA = (await adm('POST', '/vendors', { name: 'Removal Co A', registrationNo: 'RM-A' })).body.vendor.id
    ids.companyB = (await adm('POST', '/vendors', { name: 'Bystander Co B' })).body.vendor.id
    ids.insp = await account(ids.companyA, 'rm-insp', 'Ira Inspector', 'inspector')
    ids.cli = await account(ids.companyA, 'rm-cli', 'Cal Client')
    ids.chk = await account(ids.companyA, 'rm-chk', 'Chi Checker')
    ids.old = await account(ids.companyA, 'rm-old', 'Olu Former')
    ids.bcli = await account(ids.companyB, 'rm-bcli', 'Bo Client')
    // One account of A was already deactivated individually: removal must not alter that.
    assert.equal((await adm('PATCH', `/vendor-users/${ids.old}`, { active: false })).status, 200)

    // A real inspection history for A: submitted revision, Checked-by sign-off, client verification.
    const template = await adm('POST', '/checklist-templates', { vehicleType: 'FORKLIFT', name: 'Removal Test Forklift', definition })
    assert.equal(template.status, 201, JSON.stringify(template.body))
    assert.equal((await adm('POST', `/checklist-templates/${template.body.template.id}/publish`)).status, 200)
    assert.equal((await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, { signatories: { checked_by: ids.chk } })).status, 200)
    const created = await adm('POST', '/inspections', {
      companyId: ids.companyA,
      inspectorId: ids.insp,
      templateId: template.body.template.id,
      vehiclePlate: 'RMV 9001',
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    ids.inspection = created.body.inspection.id

    for (const u of ['rm-insp', 'rm-cli', 'rm-chk', 'rm-bcli']) assert.equal(await signIn(u), 200, u)
    const submit = await portal('rm-insp', 'POST', `/inspections/${ids.inspection}/submit`, { answers: { items: { a: { status: 'A' } } } })
    assert.equal(submit.status, 200, JSON.stringify(submit.body))
    assert.equal((await portal('rm-chk', 'POST', `/inspections/${ids.inspection}/signoffs/checked_by`, { revision: 1, fullName: 'Chi Checker' })).status, 200)
    assert.equal((await portal('rm-cli', 'POST', `/inspections/${ids.inspection}/verify`, { revision: 1 })).status, 200)

    historyBefore = await historyOf(ids.companyA)
    assert.deepEqual(
      { ...historyBefore, events: historyBefore.events > 0 },
      { inspections: 1, revisions: 1, signoffs: 1, events: true, signatories: 1, accounts: 4 },
      'fixture has linked history',
    )
  })
  after(() => server.close())

  it('lists the organisation with its accounts before anything is confirmed', async () => {
    // The dialog's Cancel sends no request; this is the state it must leave untouched.
    const list = (await adm('GET', '/vendors')).body.vendors
    const a = list.find((v) => v.id === ids.companyA)
    assert.equal(a.status, 'active')
    assert.equal(a.removedAt, null)
    assert.equal(a.removedBy, null)
    assert.equal(a.userCount, 4)
    assert.equal(a.activeUserCount, 3)
    assert.equal(await sessionsOf(ids.companyA), 3)
    assert.equal((await portal('rm-cli', 'GET', '/auth/me')).status, 200)
  })

  it('refuses unauthorized callers and changes nothing', async () => {
    const anonymous = new Client(server.baseUrl)
    assert.equal((await remove(anonymous, ids.companyA)).status, 401, 'not signed in')
    // A portal session (vendor cookie) is not a staff session.
    assert.equal((await remove(as['rm-cli'], ids.companyA)).status, 401, 'portal account')
    // A cookie forged from a portal token is rejected too (sessions are typed).
    const forged = new Client(server.baseUrl)
    forged.cookies.set('mashoor_staff', as['rm-cli'].cookies.get('mashoor_vendor'))
    assert.equal((await remove(forged, ids.companyA)).status, 401, 'portal token in staff cookie')
    // A deactivated admin's still-open session.
    const other = new Client(server.baseUrl)
    assert.equal((await other.post('/api/mashoor/admin/auth/login', OTHER_STAFF)).status, 200)
    await server.db.prepare('UPDATE mashoor_staff_users SET active = 0 WHERE email = ?').run(OTHER_STAFF.email)
    assert.equal((await remove(other, ids.companyA)).status, 401, 'deactivated admin')
    // Cross-site request with a valid admin session.
    assert.equal((await remove(staff, ids.companyA, { headers: { origin: 'https://evil.example' } })).status, 403, 'foreign origin')

    const a = (await adm('GET', `/vendors/${ids.companyA}`)).body.vendor
    assert.equal(a.status, 'active')
    assert.equal(await sessionsOf(ids.companyA), 3)
    assert.equal(await count("SELECT COUNT(*) AS n FROM mashoor_audit_log WHERE action = 'vendor.remove'"), 0)
  })

  it('answers 404 for an unknown organisation', async () => {
    assert.equal((await adm('POST', '/vendors/987654/remove')).status, 404)
    assert.equal((await adm('POST', '/vendors/abc/remove')).status, 404)
  })

  it('removes the organisation exactly once, recording who and when', async () => {
    // Two confirmations racing (e.g. a double click in two tabs): one wins.
    const [first, second] = await Promise.all([
      adm('POST', `/vendors/${ids.companyA}/remove`, undefined, { headers: { origin: APP_ORIGIN } }),
      adm('POST', `/vendors/${ids.companyA}/remove`, undefined, { headers: { origin: APP_ORIGIN } }),
    ])
    const statuses = [first.status, second.status].sort()
    assert.deepEqual(statuses, [200, 409], JSON.stringify([first.body, second.body]))
    const ok = first.status === 200 ? first : second
    const refused = first.status === 200 ? second : first
    assert.equal(refused.body.error, 'This organisation has already been removed.')

    assert.equal(ok.body.vendor.status, 'removed')
    assert.deepEqual(ok.body.vendor.removedBy, { id: ids.staff, name: 'Rita Remover' })
    assert.match(ok.body.vendor.removedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

    const logs = await server.db.prepare("SELECT * FROM mashoor_audit_log WHERE action = 'vendor.remove'").all()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].actor_type, 'staff')
    assert.equal(logs[0].actor_id, ids.staff)
    assert.equal(logs[0].target_type, 'vendor_company')
    assert.equal(logs[0].target_id, ids.companyA)
    assert.deepEqual(JSON.parse(logs[0].metadata), {
      name: 'Removal Co A',
      previousStatus: 'active',
      accounts: 4,
      activeAccounts: 3,
      sessionsEnded: 3,
      inspectionsKept: 1,
    })
  })

  it('drops the organisation from the default list and the dashboard', async () => {
    const list = (await adm('GET', '/vendors')).body.vendors
    assert.deepEqual(
      list.map((v) => v.name),
      ['Bystander Co B'],
    )
    const removed = (await adm('GET', '/vendors?status=removed')).body.vendors
    assert.deepEqual(
      removed.map((v) => [v.name, v.status, v.accounts.length]),
      [['Removal Co A', 'removed', 4]],
    )
    assert.equal((await adm('GET', '/vendors?status=bogus')).status, 400)
    const totals = (await adm('GET', '/dashboard')).body.totals
    assert.deepEqual(totals.vendors, { total: 1, active: 1 })
    assert.deepEqual(totals.vendorAccounts, { total: 1, active: 1 })
  })

  it('signs out every portal account of the organisation and blocks sign-in', async () => {
    assert.equal(await sessionsOf(ids.companyA), 0)
    for (const u of ['rm-insp', 'rm-cli', 'rm-chk']) {
      assert.equal((await portal(u, 'GET', '/auth/me')).status, 401, `${u} old session`)
      assert.equal((await portal(u, 'GET', '/inspections')).status, 401, `${u} data`)
      assert.equal((await portal(u, 'POST', '/realtime/ticket')).status, 401, `${u} live updates`)
      assert.equal(await signIn(u), 401, `${u} sign-in with the right password`)
    }
    // Per-account state is kept as it was (the removal is on the organisation).
    const users = (await adm('GET', `/vendors/${ids.companyA}`)).body.users
    assert.deepEqual(
      Object.fromEntries(users.map((u) => [u.username, u.active])),
      { 'rm-insp': true, 'rm-cli': true, 'rm-chk': true, 'rm-old': false },
    )
  })

  it('keeps every linked historical record', async () => {
    assert.deepEqual(await historyOf(ids.companyA), historyBefore)
    const detail = await adm('GET', `/inspections/${ids.inspection}`)
    assert.equal(detail.status, 200)
    assert.equal(detail.body.inspection.status, 'pending_approval')
    const listed = (await adm('GET', '/inspections')).body.inspections
    assert.ok(listed.some((i) => i.id === ids.inspection), 'still in the admin inspection list')
    assert.equal((await adm('GET', `/inspections/${ids.inspection}/revisions/1`)).status, 200)
  })

  it('is final: the removed organisation and its accounts cannot be changed', async () => {
    const refused = { error: 'This organisation has been removed and can no longer be changed.', code: 'organisation_removed' }
    const attempts = [
      ['PATCH', `/vendors/${ids.companyA}`, { status: 'active' }],
      ['PATCH', `/vendors/${ids.companyA}`, { name: 'Renamed' }],
      ['POST', `/vendors/${ids.companyA}/users`, { name: 'New', username: 'rm-new', password: PW }],
      ['PUT', `/vendors/${ids.companyA}/categories`, { categoryIds: [] }],
      ['PUT', `/vendors/${ids.companyA}/inspection-settings`, { signatories: { checked_by: null } }],
      ['PATCH', `/vendor-users/${ids.cli}`, { name: 'Changed' }],
      ['POST', `/vendor-users/${ids.old}/reactivate`, { password: PW }],
      ['POST', `/vendor-users/${ids.cli}/reset-password`, { password: PW }],
    ]
    for (const [method, path, body] of attempts) {
      const res = await adm(method, path, body)
      assert.equal(res.status, 409, `${method} ${path}`)
      assert.deepEqual(res.body, refused, `${method} ${path}`)
    }
    const newWork = await adm('POST', '/inspections', { companyId: ids.companyA, inspectorId: ids.insp, templateId: 1, vehiclePlate: 'X' })
    assert.equal(newWork.status, 400)
    assert.match(newWork.body.error, /has been removed/)
    assert.equal((await adm('GET', `/vendors/${ids.companyA}`)).body.vendor.status, 'removed')
    assert.equal(await count("SELECT COUNT(*) AS n FROM mashoor_vendor_users WHERE username = 'rm-new'"), 0)
  })

  it('leaves other organisations and the per-account Deactivate action working', async () => {
    assert.equal((await portal('rm-bcli', 'GET', '/auth/me')).status, 200)
    const off = await adm('PATCH', `/vendor-users/${ids.bcli}`, { active: false })
    assert.equal(off.status, 200)
    assert.equal(off.body.user.active, false)
    assert.equal((await portal('rm-bcli', 'GET', '/auth/me')).status, 401)
    assert.equal((await adm('GET', `/vendors/${ids.companyB}`)).body.vendor.status, 'active')
  })
})
