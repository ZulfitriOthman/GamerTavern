// Fictional demo data for the Mashhor inspection prototype (Mashhor-Prototype/).
//
//   MASHOOR_DEMO_DATABASE=<database name> npm run mashoor:seed-demo   (from Backend/)
//
// Safety: refuses NODE_ENV=production, and refuses unless MASHOOR_DEMO_DATABASE
// names exactly the MySQL database it is connected to — a deliberate
// confirmation, because by default Mashoor uses the Backend's own (possibly
// live) database. It creates two organisations, 13 accounts and six
// inspections. Never run it against a live database without approval.
//
// The staff account comes from the existing terminal-only setup
// (npm run mashoor:create-staff); this script signs in with it
// (DEMO_STAFF_EMAIL / DEMO_STAFF_PASSWORD) and creates everything else through
// the real admin and portal API, so every rule, history event and audit entry
// is the same as when a person does it on screen. Safe to re-run: it stops if
// the demo organisations already exist.
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { openDatabase } from '../src/db.js'
import { Client } from '../test/helpers.js'

const fail = (message) => {
  console.error(`[seed-demo] ${message}`)
  process.exit(1)
}

const config = loadConfig()
if (config.production) fail('Refusing to seed demo data when NODE_ENV=production.')
if (!process.env.MASHOOR_DEMO_DATABASE || process.env.MASHOOR_DEMO_DATABASE !== config.mysql.database) {
  fail(`Set MASHOOR_DEMO_DATABASE to the name of the database to fill (configured: ${config.mysql.database || 'none'}) to confirm it.`)
}
const STAFF = { email: process.env.DEMO_STAFF_EMAIL, password: process.env.DEMO_STAFF_PASSWORD }
if (!STAFF.email || !STAFF.password) fail('Set DEMO_STAFF_EMAIL and DEMO_STAFF_PASSWORD (create the account with mashoor:create-staff first).')

const PASSWORD = process.env.DEMO_PORTAL_PASSWORD || 'Demo-Pass-2026!'
const ORIGIN = config.allowedOrigins[0]

// Organisation A: approval is NOT blocked by a pending acknowledgement (the default).
// Organisation B: approval IS blocked until acknowledgement — for the comparison.
const ORGS = [
  {
    key: 'A',
    name: 'Demo Fleet Contract A',
    registrationNo: 'DEMO-ORG-A',
    ackBlocksApproval: false,
    accounts: [
      { username: 'a.inspector', name: 'Adam Inspector', role: 'inspector' },
      { username: 'a.inspector2', name: 'Aisyah Inspector', role: 'inspector' },
      { username: 'a.client', name: 'Clara Client', role: 'client' },
      { username: 'a.checker', name: 'Chong Checker', role: 'inspector', stage: 'checked_by' },
      { username: 'a.agreer', name: 'Aminah Agreer', role: 'client', stage: 'agreed_by' },
      { username: 'a.hoo', name: 'Harun Operations Head', role: 'inspector', stage: 'approved_by' },
      { username: 'a.ack', name: 'Aziz Acknowledger', role: 'client', stage: 'acknowledgement' },
    ],
  },
  {
    key: 'B',
    name: 'Demo Fleet Contract B',
    registrationNo: 'DEMO-ORG-B',
    ackBlocksApproval: true,
    accounts: [
      { username: 'b.inspector', name: 'Bakar Inspector', role: 'inspector' },
      { username: 'b.client', name: 'Bella Client', role: 'client' },
      { username: 'b.checker', name: 'Ben Checker', role: 'inspector', stage: 'checked_by' },
      { username: 'b.agreer', name: 'Bunga Agreer', role: 'client', stage: 'agreed_by' },
      { username: 'b.hoo', name: 'Badrul Operations Head', role: 'inspector', stage: 'approved_by' },
      { username: 'b.ack', name: 'Batrisya Acknowledger', role: 'client', stage: 'acknowledgement' },
    ],
  },
]

const db = await openDatabase(config.mysql)
if (await db.prepare('SELECT 1 FROM mashoor_vendor_companies WHERE name = ?').get(ORGS[0].name)) {
  console.log(`[seed-demo] Demo data already present in ${db.info.where} — nothing to do.`)
  await db.close()
  process.exit(0)
}

const app = createApp({ db, config: { ...config, cookieSecure: false } })
const server = await new Promise((done) => {
  const s = app.listen(0, '127.0.0.1', () => done(s))
})
const baseUrl = `http://127.0.0.1:${server.address().port}`
const headers = { origin: ORIGIN }

async function call(client, prefix, method, path, body) {
  const res = await client.request(method, `/api/mashoor/${prefix}${path}`, { body, headers })
  if (res.status >= 400) throw new Error(`${method} ${prefix}${path} → ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

try {
  const staff = new Client(baseUrl)
  const login = await staff.request('POST', '/api/mashoor/admin/auth/login', { body: STAFF, headers })
  if (login.status !== 200) throw new Error(`Staff sign-in failed for ${STAFF.email} — create it with mashoor:create-staff against this database first.`)
  const adm = (method, path, body) => call(staff, 'admin', method, path, body)

  // ---- Organisations, portal accounts, sign-off stages ----------------------
  const ids = {}
  for (const org of ORGS) {
    const { vendor } = await adm('POST', '/vendors', { name: org.name, registrationNo: org.registrationNo })
    ids[org.key] = { company: vendor.id, users: {} }
    const signatories = {}
    for (const a of org.accounts) {
      const { user } = await adm('POST', `/vendors/${vendor.id}/users`, { name: a.name, username: a.username, role: a.role, password: PASSWORD })
      ids[org.key].users[a.username] = user.id
      if (a.stage) signatories[a.stage] = user.id
    }
    await adm('PUT', `/vendors/${vendor.id}/inspection-settings`, { signatories, ackBlocksApproval: org.ackBlocksApproval })
  }

  // ---- Published templates (imported from the client's four MINDEF forms) ----
  const { templates } = await adm('GET', '/checklist-templates')
  const templateFor = (type) => {
    const t = templates.find((x) => x.vehicleType === type && x.active && x.current)
    if (!t) throw new Error(`No published ${type} template — the checklist import did not run.`)
    return t.id
  }

  const portal = {}
  async function as(username) {
    if (!portal[username]) {
      const c = new Client(baseUrl)
      const res = await c.request('POST', '/api/mashoor/portal/auth/login', { body: { username, password: PASSWORD }, headers })
      if (res.status !== 200) throw new Error(`Portal sign-in failed for ${username}`)
      portal[username] = c
    }
    return (method, path, body) => call(portal[username], 'portal', method, path, body)
  }

  async function create(orgKey, inspector, type, vehicle) {
    const { inspection } = await adm('POST', '/inspections', {
      companyId: ids[orgKey].company,
      inspectorId: ids[orgKey].users[inspector],
      templateId: templateFor(type),
      ...vehicle,
    })
    return inspection
  }

  // Every item marked explicitly; measurements filled where the form has them.
  function completeAnswers(definition, { itemRemarks = {}, remarks = '', damageNotes = '', markers = [], extent = 'None', nextServicing = '' } = {}) {
    const satisfactory = definition.statusLegend[0].value
    const sample = (m) => (m.unit === 'PSI' ? '32' : m.unit === 'MM' ? '7' : '12.6')
    const items = {}
    for (const section of definition.sections) {
      for (const item of section.items) {
        const answer = {}
        if (item.status) answer.status = satisfactory
        for (const m of item.measurements) {
          answer.measurements = {
            ...answer.measurements,
            [m.key]: m.layout === 'single' ? { value: sample(m) } : { front_r: sample(m), front_l: sample(m), rear_r: sample(m), rear_l: sample(m) },
          }
        }
        items[item.key] = answer
        for (const child of item.children ?? []) if (child.status) items[child.key] = { status: satisfactory }
      }
    }
    // Item-level remarks: { index: { status, remark, action } } over the status items in order.
    const statusKeys = Object.keys(items).filter((k) => items[k].status)
    for (const [index, value] of Object.entries(itemRemarks)) Object.assign(items[statusKeys[Number(index)]], value)
    const details = {}
    for (const d of definition.details) if (d.default) details[d.key] = d.default
    Object.assign(details, { mileage: '45210', date: '2026-11-18', location: 'Demo Depot, Bay 3' })
    return {
      details: Object.fromEntries(Object.entries(details).filter(([k]) => definition.details.some((d) => d.key === k))),
      items,
      remarks,
      nextServicing: definition.footer.nextServicing ? nextServicing : '',
      damage: definition.damage.enabled ? { extent, notes: damageNotes, markers } : { extent: null, notes: '', markers: [] },
    }
  }

  const sign = async (username, inspection, stage, fullName) =>
    (await as(username))('POST', `/inspections/${inspection.id}/signoffs/${stage}`, { revision: inspection.currentRevision, fullName })

  // A1 — assigned, not yet opened.
  await create('A', 'a.inspector', 'FORKLIFT', { vehiclePlate: 'DEMO 1001', modRegistrationNo: 'MOD-D-1001' })

  // A2 — draft: the inspector saved part of the checklist.
  const a2 = await create('A', 'a.inspector', 'MEDIUM BUS', { vehiclePlate: 'DEMO 2002', vehicleRegistrationNo: 'REG-D-2002' })
  {
    const full = completeAnswers(a2.working.definition)
    const firstKeys = Object.keys(full.items).slice(0, 6)
    const partial = { ...full, items: Object.fromEntries(firstKeys.map((k) => [k, full.items[k]])), damage: { extent: null, notes: '', markers: [] } }
    await (await as('a.inspector'))('PUT', `/inspections/${a2.id}/form`, { answers: partial })
  }

  // A3 — submitted with no remarks: auto-acknowledged, awaiting client verification.
  const a3 = await create('A', 'a.inspector', 'LARGE BUS', { vehiclePlate: 'DEMO 3003', vehicleRegistrationNo: 'REG-D-3003', modRegistrationNo: 'MOD-D-3003' })
  await (await as('a.inspector'))('POST', `/inspections/${a3.id}/submit`, { answers: completeAnswers(a3.working.definition) })

  // A4 — approved with remarks; acknowledgement still pending (allowed in A, see handover C4).
  const a4 = await create('A', 'a.inspector2', 'DOUBLE CAB HILUX', { vehiclePlate: 'DEMO 4004', modRegistrationNo: 'MOD-D-4004' })
  {
    const answers = completeAnswers(a4.working.definition, {
      itemRemarks: { 2: { status: 'x', remark: 'Wiper blade worn on driver side.', action: 'Replace wiper blade.' } },
      remarks: 'Vehicle fit for use after wiper replacement.',
      nextServicing: '50,000 KM',
    })
    let { inspection } = await (await as('a.inspector2'))('POST', `/inspections/${a4.id}/submit`, { answers })
    ;({ inspection } = await (await as('a.client'))('POST', `/inspections/${a4.id}/verify`, { revision: inspection.currentRevision }))
    ;({ inspection } = await sign('a.checker', inspection, 'checked_by', 'Chong Checker'))
    ;({ inspection } = await sign('a.agreer', inspection, 'agreed_by', 'Aminah Agreer'))
    await sign('a.hoo', inspection, 'approved_by', 'Harun Operations Head')
  }

  // B1 — organisation B blocks approval while acknowledgement is pending. The only
  // remark is a damage-marker note, which still counts as a remark.
  const b1 = await create('B', 'b.inspector', 'DOUBLE CAB HILUX', { vehiclePlate: 'DEMO 6006', vehicleRegistrationNo: 'REG-D-6006' })
  {
    const answers = completeAnswers(b1.working.definition, {
      extent: 'Minor',
      markers: [{ id: 'm1', x: 0.32, y: 0.41, note: 'Small dent on rear left door.' }],
    })
    let { inspection } = await (await as('b.inspector'))('POST', `/inspections/${b1.id}/submit`, { answers })
    ;({ inspection } = await sign('b.checker', inspection, 'checked_by', 'Ben Checker'))
    ;({ inspection } = await (await as('b.client'))('POST', `/inspections/${b1.id}/verify`, { revision: inspection.currentRevision }))
    await sign('b.agreer', inspection, 'agreed_by', 'Bunga Agreer')
  }

  // B2 — assigned in organisation B (never visible to organisation A accounts).
  await create('B', 'b.inspector', 'FORKLIFT', { vehiclePlate: 'DEMO 7007', modRegistrationNo: 'MOD-D-7007' })

  console.log(`[seed-demo] Seeded ${db.info.where}
  Staff (admin site, email)   : ${STAFF.email} / (DEMO_STAFF_PASSWORD)
  Portal accounts (username)  : ${ORGS.flatMap((o) => o.accounts.map((a) => a.username)).join(', ')}
  Portal password (all)       : ${PASSWORD}
  Inspections                 : A1 assigned, A2 draft, A3 pending verification (auto-ack),
                                A4 approved (ack pending), B1 pending approval (HOO blocked by ack), B2 assigned`)
} catch (error) {
  console.error(`[seed-demo] ${error.message}`)
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  server.close()
  await db.close()
}
