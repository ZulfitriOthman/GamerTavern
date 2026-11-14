// Vehicle inspection workflow over real HTTP sessions, with isolated accounts:
// Company A — inspector, client, Checked-by, Agreed-by, Head of Operation (HOO)
// and an acknowledger; Company B — an unrelated organisation.
// Template content below is test data only; the client's real checklists are
// covered by checklistForms.test.js.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { Client, insertStaff, startTestServer } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const PW = 'Account-Pass-2026'
const ALI = 'Ali bin Haji Abd Rahman'
const KEYS = ['a', 'b', 'c']

// A small TEST form: one section, three status items, legend A/B.
const testDefinition = (prefix, labels = ['item A', 'item B', 'item C']) => ({
  header: { companyName: 'TEST CO', title: 'TEST CHECKLIST', subtitle: '', showLogos: false },
  details: [{ key: 'date', default: '', required: false }],
  statusLegend: [
    { value: 'A', label: 'Option One' },
    { value: 'B', label: 'Option Two' },
  ],
  sections: [
    {
      key: 's1',
      number: '1.',
      title: 'Section 1',
      column: 1,
      items: labels.map((label, i) => ({ key: KEYS[i], number: '1.' + (i + 1), label: prefix + ' ' + label })),
    },
  ],
  footer: { remarks: true, nextServicing: false },
  damage: { enabled: false },
})

describe('vehicle inspections', () => {
  let server
  let staff
  const ids = {}
  const as = {} // username → signed-in Client

  const api = (client, method, path, body) => client.request(method, `/api/mashoor/portal${path}`, { body })
  const adm = (method, path, body) => staff.request(method, `/api/mashoor/admin${path}`, { body })
  async function account(companyId, username, name, role = 'client') {
    const res = await adm('POST', `/vendors/${companyId}/users`, { name, username, password: PW, role })
    assert.equal(res.status, 201, `${username}: ${JSON.stringify(res.body)}`)
    return res.body.user.id
  }
  async function signIn(username) {
    const c = new Client(server.baseUrl)
    const res = await c.post('/api/mashoor/portal/auth/login', { username, password: PW })
    assert.equal(res.status, 200, username)
    as[username] = c
    return res
  }
  async function newInspection(extra = {}) {
    const res = await adm('POST', '/inspections', {
      companyId: ids.companyA,
      inspectorId: ids.inspector,
      templateId: ids.template,
      vehiclePlate: 'WXY 1234',
      vehicleRegistrationNo: 'REG-001',
      modRegistrationNo: 'MOD-9',
      ...extra,
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.inspection
  }
  const detail = async (username, id) => (await api(as[username], 'GET', `/inspections/${id}`)).body
  async function fillAndSubmit(id, { remarks = {}, actions = {} } = {}) {
    const items = {}
    KEYS.forEach((key, i) => {
      items[key] = { status: i % 2 ? 'B' : 'A', remark: remarks[i] ?? '', action: actions[i] ?? '' }
    })
    return api(as.insp, 'POST', `/inspections/${id}/submit`, { answers: { items } })
  }
  async function createPublished(vehicleType, name, definition) {
    const res = await adm('POST', '/checklist-templates', { vehicleType, name, definition })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const pub = await adm('POST', `/checklist-templates/${res.body.template.id}/publish`)
    assert.equal(pub.status, 200, JSON.stringify(pub.body))
    return res.body.template.id
  }

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Staff' })
    staff = new Client(server.baseUrl)
    await staff.post('/api/mashoor/admin/auth/login', STAFF)
    ids.companyA = (await adm('POST', '/vendors', { name: 'Company A' })).body.vendor.id
    ids.companyB = (await adm('POST', '/vendors', { name: 'Company B' })).body.vendor.id
    ids.inspector = await account(ids.companyA, 'insp', 'Ian Inspector', 'inspector')
    ids.client = await account(ids.companyA, 'cli', 'Cara Client')
    ids.checker = await account(ids.companyA, 'checker', 'Chad Checker')
    ids.agreer = await account(ids.companyA, 'agreer', 'Agnes Agreer')
    ids.hoo = await account(ids.companyA, 'hoo', 'Hana Head')
    ids.ali = await account(ids.companyA, 'ali', ALI)
    ids.inspectorB = await account(ids.companyB, 'inspb', 'Ben Inspector', 'inspector')
    ids.clientB = await account(ids.companyB, 'clib', 'Bea Client')
    for (const u of ['insp', 'cli', 'checker', 'agreer', 'hoo', 'ali', 'inspb', 'clib']) await signIn(u)
  })
  after(() => server.close())

  it('admin assigns different roles to two accounts of the same company', async () => {
    const detailA = await adm('GET', `/vendors/${ids.companyA}`)
    const roles = Object.fromEntries(detailA.body.users.map((u) => [u.username, u.role]))
    assert.equal(roles.insp, 'inspector')
    assert.equal(roles.cli, 'client')
    assert.equal((await adm('POST', `/vendors/${ids.companyA}/users`, { name: 'X', username: 'xx-bad', password: PW, role: 'admin' })).status, 400)
    // Existing default stays client; a role change applies on the next request.
    const me = (await api(as.cli, 'GET', '/auth/me')).body
    assert.equal(me.user.role, 'client')
    assert.equal((await api(as.insp, 'GET', '/auth/me')).body.user.role, 'inspector')
  })

  it('inspectors cannot use the catalog; clients still can', async () => {
    assert.equal((await api(as.insp, 'GET', '/listings')).status, 403)
    assert.equal((await api(as.insp, 'GET', '/categories')).status, 403)
    assert.equal((await api(as.cli, 'GET', '/listings')).status, 200)
  })

  it('templates support all four vehicle types and copy into inspections', async () => {
    for (const vehicleType of ['FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS']) {
      const id = await createPublished(vehicleType, `${vehicleType} test template`, testDefinition(vehicleType))
      if (vehicleType === 'FORKLIFT') ids.template = id
      if (vehicleType === 'LARGE BUS') ids.busTemplate = id
    }
    assert.equal((await adm('POST', '/checklist-templates', { vehicleType: 'TRUCK', name: 'x' })).status, 400)
    // A blank template (no items, no legend) cannot be published.
    const empty = await adm('POST', '/checklist-templates', { vehicleType: 'MEDIUM BUS', name: 'Empty' })
    assert.equal(empty.status, 201)
    ids.emptyTemplate = empty.body.template.id
    const pub = await adm('POST', `/checklist-templates/${ids.emptyTemplate}/publish`)
    assert.equal(pub.status, 400)
    assert.ok(pub.body.problems.length >= 2)
  })

  it('validates new inspections: inspector role, same company, template content, vehicle identifiers', async () => {
    const base = { companyId: ids.companyA, inspectorId: ids.inspector, templateId: ids.template, vehiclePlate: 'P1' }
    assert.equal((await adm('POST', '/inspections', { ...base, inspectorId: ids.client })).status, 400, 'client account is not an inspector')
    assert.equal((await adm('POST', '/inspections', { ...base, inspectorId: ids.inspectorB })).status, 400, 'other company')
    assert.equal((await adm('POST', '/inspections', { ...base, templateId: ids.emptyTemplate })).status, 400, 'template never published')
    assert.equal((await adm('POST', '/inspections', { ...base, vehiclePlate: '' })).status, 400, 'no identifier')
    const bus = await newInspection({ templateId: ids.busTemplate })
    assert.equal(bus.vehicle.type, 'LARGE BUS')
    assert.deepEqual(bus.working.definition.sections[0].items.map((i) => i.label), ['LARGE BUS item A', 'LARGE BUS item B', 'LARGE BUS item C'])
    assert.equal(bus.templateVersion, 1)
    assert.deepEqual(bus.vehicle, { type: 'LARGE BUS', plate: 'WXY 1234', registrationNo: 'REG-001', modRegistrationNo: 'MOD-9' })
  })

  it('a later template version never changes an existing inspection', async () => {
    const before = await newInspection()
    const draft = await adm('PUT', `/checklist-templates/${ids.template}/draft`, { definition: testDefinition('FORKLIFT', ['Changed later', 'item B', 'item C']) })
    assert.equal(draft.status, 200)
    assert.equal(draft.body.draft.version, 2)
    assert.equal((await adm('POST', `/checklist-templates/${ids.template}/publish`)).status, 200)
    const after = (await adm('GET', `/inspections/${before.id}`)).body.inspection
    assert.deepEqual(after.working.definition, before.working.definition)
    assert.equal(after.templateVersion, 1)
    const newer = await newInspection()
    assert.equal(newer.templateVersion, 2)
    assert.equal(newer.working.definition.sections[0].items[0].label, 'FORKLIFT Changed later')
    // Back to the original wording as version 3 for the rest of the suite.
    await adm('PUT', `/checklist-templates/${ids.template}/draft`, { definition: testDefinition('FORKLIFT') })
    await adm('POST', `/checklist-templates/${ids.template}/publish`)
  })

  it('admin signatory assignment only accepts active accounts of the same company', async () => {
    assert.equal((await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, { signatories: { approved_by: ids.clientB } })).status, 400)
    const res = await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, {
      signatories: { checked_by: ids.checker, agreed_by: ids.agreer, approved_by: ids.hoo, acknowledgement: ids.ali },
    })
    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.signatories.map((s) => [s.stage, s.assignee?.id]),
      [['checked_by', ids.checker], ['agreed_by', ids.agreer], ['approved_by', ids.hoo], ['acknowledgement', ids.ali]],
    )
    assert.equal(res.body.ackBlocksApproval, false)
  })

  it('full flow: submit → re-check with reason → resubmit → verify → sign-offs → HOO approval', async () => {
    const insp = await newInspection()
    ids.flow = insp.id
    // Inspector queue + draft save
    const assigned = (await api(as.insp, 'GET', '/inspections?queue=assigned')).body.inspections
    assert.ok(assigned.some((i) => i.id === insp.id))
    const bad = await api(as.insp, 'PUT', `/inspections/${insp.id}/form`, { answers: { items: { a: { status: 'Invented status' } } } })
    assert.equal(bad.status, 400, 'only the template status marks are accepted')
    const saved = await api(as.insp, 'PUT', `/inspections/${insp.id}/form`, { answers: { items: { a: { status: 'A', remark: 'Scratch on mast' } } } })
    assert.equal(saved.body.inspection.status, 'draft')
    const incomplete = await api(as.insp, 'POST', `/inspections/${insp.id}/submit`, {})
    assert.equal(incomplete.status, 400, 'every item needs a status')
    assert.deepEqual(incomplete.body.problems.map((p) => p.field), ['item.b.status', 'item.c.status'])
    assert.equal((await api(as.cli, 'PUT', `/inspections/${insp.id}/form`, { answers: {} })).status, 403, 'clients cannot edit')

    // Submit revision 1 with a remark → acknowledgement pending
    const sub = await fillAndSubmit(insp.id, { remarks: { 0: 'Scratch on mast' }, actions: { 0: 'Repaint' } })
    assert.equal(sub.status, 200)
    let d = (await detail('cli', insp.id)).inspection
    assert.equal(d.status, 'pending_verification')
    assert.equal(d.currentRevision, 1)
    const rev1 = d.revisions.find((r) => r.current)
    assert.equal(rev1.acknowledgement, 'pending')
    assert.deepEqual(
      rev1.summary.map((s) => [s.label, s.remark, s.action, s.vehicle.plate]),
      [['FORKLIFT item A', 'Scratch on mast', 'Repaint', 'WXY 1234']],
      'summary = exactly the entered remarks/actions with the vehicle',
    )
    assert.equal((await detail('cli', insp.id)).inspection.working, undefined, 'clients review the submitted revision, not the working copy')

    // Checked by signs revision 1 before the re-check
    assert.equal((await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/checked_by`, { revision: 1, fullName: 'Chad Checker' })).status, 200)

    // Re-check needs an explanation; inspectors cannot decide
    assert.equal((await api(as.cli, 'POST', `/inspections/${insp.id}/recheck`, { revision: 1, reason: ' ' })).status, 400)
    assert.equal((await api(as.insp, 'POST', `/inspections/${insp.id}/recheck`, { revision: 1, reason: 'Fix it please' })).status, 403)
    assert.equal((await api(as.cli, 'POST', `/inspections/${insp.id}/recheck`, { revision: 0, reason: 'Item B photo missing' })).status, 409)
    const re = await api(as.cli, 'POST', `/inspections/${insp.id}/recheck`, { revision: 1, reason: 'Item B status looks wrong — please re-inspect.' })
    assert.equal(re.status, 200)
    assert.equal(re.body.inspection.status, 'returned')

    // Inspector sees the reason in the re-check queue
    const returned = (await api(as.insp, 'GET', '/inspections?queue=returned')).body.inspections
    assert.equal(returned.find((i) => i.id === insp.id).recheckReason, 'Item B status looks wrong — please re-inspect.')
    assert.equal((await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/agreed_by`, { revision: 1, fullName: 'Agnes Agreer' })).status, 403, 'not their stage')
    assert.equal((await api(as.agreer, 'POST', `/inspections/${insp.id}/signoffs/agreed_by`, { revision: 1, fullName: 'Agnes Agreer' })).status, 409, 'returned: stage closed')

    // Resubmit without remarks → revision 2, auto-acknowledged by the system
    const resub = await fillAndSubmit(insp.id)
    assert.equal(resub.status, 200)
    d = (await detail('cli', insp.id)).inspection
    assert.equal(d.currentRevision, 2)
    assert.equal(d.recheckReason, null)
    const rev2 = d.revisions.find((r) => r.current)
    assert.equal(rev2.acknowledgement, 'auto')
    assert.deepEqual(rev2.summary, [])
    assert.deepEqual(rev2.signoffs, [], 'the old Checked-by sign-off does not carry over')
    const old = d.revisions.find((r) => r.revision === 1)
    assert.deepEqual(old.signoffs.map((s) => [s.stage, s.name]), [['checked_by', 'Chad Checker']], 'history kept on revision 1')
    const auto = d.events.find((e) => e.action === 'acknowledgement.auto')
    assert.equal(auto.actorType, 'system')
    assert.equal(auto.actorName, null, 'not attributed to the acknowledger')
    assert.equal(auto.detail, 'Auto-acknowledged — no remarks.')
    assert.equal((await api(as.ali, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 2, fullName: ALI })).status, 409)

    // Stale revision is refused; client verifies revision 2
    assert.equal((await api(as.cli, 'POST', `/inspections/${insp.id}/verify`, { revision: 1 })).status, 409)
    assert.equal((await api(as.insp, 'POST', `/inspections/${insp.id}/verify`, { revision: 2 })).status, 403)
    const ver = await api(as.cli, 'POST', `/inspections/${insp.id}/verify`, { revision: 2 })
    assert.equal(ver.body.inspection.status, 'pending_approval')
    assert.equal(ver.body.inspection.revisions.find((r) => r.current).verifiedBy.name, 'Cara Client')

    // HOO can't approve before Checked by + Agreed by on THIS revision
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 2, fullName: 'Hana Head' })).status, 409)
    // Wrong name, or someone else's name, never signs
    assert.equal((await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/checked_by`, { revision: 2, fullName: 'Hana Head' })).status, 400)
    assert.equal((await api(as.cli, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 2, fullName: 'Hana Head' })).status, 403)
    assert.equal((await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/checked_by`, { revision: 2, fullName: '  chad   CHECKER ' })).status, 200)
    assert.equal((await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/checked_by`, { revision: 2, fullName: 'Chad Checker' })).status, 409, 'no duplicates')
    assert.equal((await api(as.agreer, 'POST', `/inspections/${insp.id}/signoffs/agreed_by`, { revision: 2, fullName: 'Agnes Agreer' })).status, 200)
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 1, fullName: 'Hana Head' })).status, 409, 'stale revision')
    const ok = await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 2, fullName: 'Hana Head' })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.inspection.status, 'approved')
    const signoffs = ok.body.inspection.revisions.find((r) => r.current).signoffs
    assert.deepEqual(signoffs.map((s) => [s.stage, s.userId, s.name]), [
      ['checked_by', ids.checker, 'Chad Checker'],
      ['agreed_by', ids.agreer, 'Agnes Agreer'],
      ['approved_by', ids.hoo, 'Hana Head'],
    ])
    assert.ok(signoffs.every((s) => s.signedAt))
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 2, fullName: 'Hana Head' })).status, 409)
    const completed = (await api(as.cli, 'GET', '/inspections?queue=completed')).body.inspections
    assert.ok(completed.some((i) => i.id === insp.id))

    // Audit trail
    const actions = ok.body.inspection.events.map((e) => e.action)
    for (const a of ['created', 'started', 'submitted', 'signed.checked_by', 'recheck_requested', 'resubmitted', 'acknowledgement.auto', 'submitted_for_approval', 'signed.agreed_by', 'signed.approved_by']) {
      assert.ok(actions.includes(a), a)
    }
    const audit = server.db.prepare("SELECT action FROM audit_log WHERE target_type = 'inspection' AND target_id = ?").all(insp.id).map((r) => r.action)
    for (const a of ['inspection.submitted', 'inspection.recheck_requested', 'inspection.resubmitted', 'inspection.acknowledgement_auto', 'inspection.verified', 'inspection.signed.approved_by']) {
      assert.ok(audit.includes(a), a)
    }
  })

  it('acknowledgement: pending with remarks; only the assigned account, with its own name', async () => {
    const insp = await newInspection()
    await fillAndSubmit(insp.id, { remarks: { 1: 'Horn weak' } })
    const rev = (await detail('cli', insp.id)).inspection.revisions.find((r) => r.current)
    assert.equal(rev.acknowledgement, 'pending')
    // Someone else typing Ali's name gets nothing
    assert.equal((await api(as.cli, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 1, fullName: ALI })).status, 403)
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 1, fullName: ALI })).status, 403)
    // Ali with a wrong name is refused; with his own (any case/spacing) succeeds
    assert.equal((await api(as.ali, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 1, fullName: 'Ali' })).status, 400)
    const ok = await api(as.ali, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 1, fullName: '  ali BIN haji abd   rahman ' })
    assert.equal(ok.status, 200)
    const r = ok.body.inspection.revisions.find((x) => x.current)
    assert.equal(r.acknowledgement, 'acknowledged')
    assert.deepEqual(r.signoffs.map((s) => [s.stage, s.userId, s.name]), [['acknowledgement', ids.ali, ALI]])
    ids.ackInspection = insp.id
  })

  it('a changed revision re-evaluates acknowledgement (remarks added on resubmit → pending again)', async () => {
    const insp = await newInspection()
    await fillAndSubmit(insp.id) // no remarks → auto
    assert.equal((await detail('cli', insp.id)).inspection.revisions[0].acknowledgement, 'auto')
    await api(as.cli, 'POST', `/inspections/${insp.id}/recheck`, { revision: 1, reason: 'Please note the tyre wear.' })
    await fillAndSubmit(insp.id, { remarks: { 2: 'Tyre wear' } })
    const d = (await detail('cli', insp.id)).inspection
    assert.equal(d.revisions.find((r) => r.current).acknowledgement, 'pending')
    assert.equal(d.revisions.find((r) => r.revision === 1).acknowledgement, 'auto')
  })

  it('optionally blocks HOO approval until acknowledgement (company setting)', async () => {
    await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, { ackBlocksApproval: true })
    const insp = await newInspection()
    await fillAndSubmit(insp.id, { remarks: { 0: 'Mirror cracked' } })
    await api(as.cli, 'POST', `/inspections/${insp.id}/verify`, { revision: 1 })
    await api(as.checker, 'POST', `/inspections/${insp.id}/signoffs/checked_by`, { revision: 1, fullName: 'Chad Checker' })
    await api(as.agreer, 'POST', `/inspections/${insp.id}/signoffs/agreed_by`, { revision: 1, fullName: 'Agnes Agreer' })
    const blocked = await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 1, fullName: 'Hana Head' })
    assert.equal(blocked.status, 409)
    assert.match(blocked.body.error, /acknowledgement/i)
    await api(as.ali, 'POST', `/inspections/${insp.id}/signoffs/acknowledgement`, { revision: 1, fullName: ALI })
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 1, fullName: 'Hana Head' })).status, 200)
    await adm('PUT', `/vendors/${ids.companyA}/inspection-settings`, { ackBlocksApproval: false })
  })

  it('blocks cross-company reads, edits, decisions and sign-offs', async () => {
    const insp = await newInspection()
    await fillAndSubmit(insp.id, { remarks: { 0: 'x' } })
    for (const user of ['inspb', 'clib']) {
      assert.equal((await api(as[user], 'GET', `/inspections/${insp.id}`)).status, 404, user)
      assert.equal((await api(as[user], 'PUT', `/inspections/${insp.id}/form`, { answers: {} })).status, 404, user)
      assert.equal((await api(as[user], 'POST', `/inspections/${insp.id}/verify`, { revision: 1 })).status, 404, user)
      assert.equal((await api(as[user], 'POST', `/inspections/${insp.id}/recheck`, { revision: 1, reason: 'cross company' })).status, 404, user)
      assert.equal((await api(as[user], 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 1, fullName: 'Bea Client' })).status, 404, user)
    }
    for (const q of ['pending_verification', 'pending_approval', 'completed', 'returned']) {
      assert.deepEqual((await api(as.clib, 'GET', `/inspections?queue=${q}`)).body.inspections, [], q)
    }
    assert.deepEqual((await api(as.inspb, 'GET', '/inspections?queue=submitted')).body.inspections, [])
  })

  it('another inspector of the same company cannot see or edit an unassigned checklist', async () => {
    const other = await account(ids.companyA, 'insp2', 'Ivy Inspector', 'inspector')
    await signIn('insp2')
    const insp = await newInspection()
    assert.equal((await api(as.insp2, 'GET', `/inspections/${insp.id}`)).status, 404)
    assert.equal((await api(as.insp2, 'PUT', `/inspections/${insp.id}/form`, { answers: {} })).status, 404)
    // Reassigning moves it to them
    assert.equal((await adm('PATCH', `/inspections/${insp.id}`, { inspectorId: other })).status, 200)
    assert.equal((await api(as.insp2, 'GET', `/inspections/${insp.id}`)).status, 200)
    assert.equal((await api(as.insp, 'GET', `/inspections/${insp.id}`)).status, 404)
  })

  it('a deactivated signatory loses access immediately', async () => {
    const insp = await newInspection()
    await fillAndSubmit(insp.id)
    await api(as.cli, 'POST', `/inspections/${insp.id}/verify`, { revision: 1 })
    await adm('PATCH', `/vendor-users/${ids.hoo}`, { active: false })
    assert.equal((await api(as.hoo, 'GET', `/inspections/${insp.id}`)).status, 401)
    assert.equal((await api(as.hoo, 'POST', `/inspections/${insp.id}/signoffs/approved_by`, { revision: 1, fullName: 'Hana Head' })).status, 401)
    assert.equal((await new Client(server.baseUrl).post('/api/mashoor/portal/auth/login', { username: 'hoo', password: PW })).status, 401)
  })

  it('switching a role takes effect on the next request', async () => {
    assert.equal((await adm('PATCH', `/vendor-users/${ids.client}`, { role: 'inspector' })).status, 200)
    assert.equal((await api(as.cli, 'GET', '/listings')).status, 403)
    assert.equal((await api(as.cli, 'GET', '/auth/me')).body.user.role, 'inspector')
    assert.equal((await adm('PATCH', `/vendor-users/${ids.client}`, { role: 'client' })).status, 200)
    assert.equal((await api(as.cli, 'GET', '/listings')).status, 200)
  })
})
