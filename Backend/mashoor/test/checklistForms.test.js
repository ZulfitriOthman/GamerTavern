// Checklist form templates imported from the client's "MASHHOR - MOD CHECKLIST"
// PDF, template versioning, and the structured inspection form (measurements,
// remarks/actions, damage markers) through the workflow. Accounts are isolated
// test accounts; inspection answers are TEST values.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { runChecklistImport } from '../src/checklist/seed.js'
import { APP_ORIGIN, Client, insertStaff, startTestServer, TINY_PNG } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const PW = 'Account-Pass-2026'

// Re-typed from the PDF pages, independently of src/checklist/mashhorModChecklist.js:
// [number, label] per row, nested rows as ['-', label].
const EXPECTED = {
  FORKLIFT: {
    page: 1,
    model: 'Forklift',
    nextServicing: true,
    sections: [
      ['1.', 'Exterior', ['1.1 License Plate', '1.2 Side Mirror (Left&Right)', '1.3 Tire ;', '1.4 First Aid Kit', '1.5 Fire Extinguisher', '1.6 Seat Belt']],
      [
        '2.',
        'Before Turning Ignition Key (Engine)',
        ['2.1 Accelerator', '2.2 Motor Oil Level', '2.3 Coolant Level', '2.4 Brake Fluids', '2.5 Steering', '2.6 Battery Voltage', '2.7 Fuel Level'],
      ],
      [
        '3.',
        'After Starting The Engine',
        [
          '3.1 Engine Start Key',
          '3.2 Hoses',
          '3.4 Hydraulic Controls',
          '3.5 Forks',
          '3.6 Foot Brake',
          '3.7 Steering Operations',
          '3.8 Horn',
          '3.9 Lights :',
          '- Head Light',
          '- Tail Light',
          '- Emergency Light',
          '- Warning Light',
          '- Turn Signal Indicator',
          '- Reverse Light',
          '- Brake Light',
        ],
      ],
    ],
  },
}
const busExterior = (toolbox) => [
  '1.',
  `Exterior & Inside ${toolbox}`,
  [
    '1.1 Road Tax (Availability & Validity)',
    '1.2 License Plate',
    '1.3 Side Mirror (Left & Right)',
    '1.4 Rearview Mirror',
    '1.5 Vehicle Body (Refer to Diagram)',
    '1.6 Tire ;',
    '1.7 First Aid Kit',
    '1.8 Warning Triangle',
    '1.9 Fire Extinguisher',
    '1.10 Seat Belt (Driver, Front & Rear Passenger)',
    '1.11 Rear Camera',
  ],
]
const busEngine = [
  '2.',
  'Before Turning Ignition Key (Engine)',
  ['2.1 Motor Oil Level', '2.2 Coolant Level', '2.3 Brake Fluids', '2.4 Battery Water Level', '2.5 Battery Voltage', '2.6 Wiper & Windshield Fluid'],
]
const busAfter = (lamps) => [
  '3.',
  'After Starting The Engine',
  [
    '3.1 Engine Start Key / Remote',
    '3.2 Central Lock',
    '3.3 Power Window',
    '3.4 Service Information',
    '3.5 Radio & Tape / CD Player',
    '3.6 Air Conditioner / Heater',
    '3.7 Brake Operations;',
    '- Hand Brake, Foot Brake & ABS',
    '3.8 Steering Operations',
    '3.9 Horn',
    '3.10 Lamps (Function) ;',
    ...lamps.map((l) => `- ${l}`),
  ],
]
const LAMPS_9 = ['Interior Light', 'Emergency Light', 'Head Light', 'Tail Light', 'Turn Signal Indicator', 'Warning Light', 'Brake Light', 'Reverse Light', 'Parking & License Plate Light']
EXPECTED['MEDIUM BUS'] = {
  page: 3,
  model: 'ROSA (Medium Bus 22 seaters)',
  nextServicing: true,
  sections: [
    busExterior('Toolbox'),
    busEngine,
    busAfter(['Interior Light', 'Emergency Light', 'Head Light', 'Taillight', 'Turn Signal Indicator', 'Warning Light', 'Brake Light', 'Reverse Light']),
  ],
}
EXPECTED['LARGE BUS'] = {
  page: 5,
  model: 'Ankai (Large Bus 45 seaters)',
  nextServicing: false,
  sections: [busExterior('Tool Box'), busEngine, busAfter(LAMPS_9), ['4.', '', ['4.1 TV', '4.2 Microphone', '4.3 CCTV']]],
}
EXPECTED['DOUBLE CAB HILUX'] = {
  page: 7,
  model: 'DOUBLE CAB (HILUX)',
  nextServicing: true,
  sections: [busExterior('Tool Box'), busEngine, busAfter(LAMPS_9)],
}

const rowsOf = (section) => section.items.flatMap((i) => [`${i.number} ${i.label}`, ...(i.children ?? []).map((c) => `- ${c.label}`)])

describe('checklist form templates (client PDF) and structured inspections', () => {
  let server
  let staff
  const ids = {}
  const as = {}
  const api = (client, method, path, body) => client.request(method, `/api/mashoor/portal${path}`, { body })
  const adm = (method, path, body) => staff.request(method, `/api/mashoor/admin${path}`, { body })

  async function account(companyId, username, name, role = 'client') {
    const res = await adm('POST', `/vendors/${companyId}/users`, { name, username, password: PW, role })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const c = new Client(server.baseUrl)
    assert.equal((await c.post('/api/mashoor/portal/auth/login', { username, password: PW })).status, 200)
    as[username] = c
    return res.body.user.id
  }
  const templateFor = async (vehicleType) => (await adm('GET', '/checklist-templates')).body.templates.find((t) => t.vehicleType === vehicleType && t.imported)
  async function newInspection(vehicleType = 'FORKLIFT') {
    const t = await templateFor(vehicleType)
    const res = await adm('POST', '/inspections', {
      companyId: ids.companyA,
      inspectorId: ids.inspector,
      templateId: t.id,
      vehiclePlate: 'TEST 1',
      modRegistrationNo: 'MOD TEST-1',
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.inspection
  }
  // Every status item answered "/" (Satisfactory) plus the required details.
  function completeAnswers(definition, extra = {}) {
    const items = {}
    for (const s of definition.sections) {
      for (const i of s.items) {
        if (i.status) items[i.key] = { status: '/' }
        for (const c of i.children) if (c.status) items[c.key] = { status: '/' }
      }
    }
    return {
      details: { model: 'Forklift', mileage: '1520', date: '2026-11-14', location: 'TEST yard', divProject: 'Berakas Office / MINDEF Project' },
      items,
      remarks: '',
      nextServicing: '',
      damage: { extent: 'None', notes: '', markers: [] },
      ...extra,
    }
  }

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Staff' })
    staff = new Client(server.baseUrl)
    await staff.post('/api/mashoor/admin/auth/login', STAFF)
    ids.companyA = (await adm('POST', '/vendors', { name: 'TEST Company A' })).body.vendor.id
    ids.companyB = (await adm('POST', '/vendors', { name: 'TEST Company B' })).body.vendor.id
    ids.inspector = await account(ids.companyA, 'insp', 'Ian Inspector', 'inspector')
    ids.client = await account(ids.companyA, 'cli', 'Cara Client')
    ids.clientB = await account(ids.companyB, 'clib', 'Bea Client')
  })
  after(() => server.close())

  it('imports one published template per PDF vehicle form, matching the source pages', async () => {
    const list = (await adm('GET', '/checklist-templates')).body.templates.filter((t) => t.imported)
    assert.deepEqual(list.map((t) => t.vehicleType).sort(), ['DOUBLE CAB HILUX', 'FORKLIFT', 'LARGE BUS', 'MEDIUM BUS'])
    for (const t of list) {
      const expected = EXPECTED[t.vehicleType]
      const full = (await adm('GET', `/checklist-templates/${t.id}`)).body
      assert.equal(full.current.version, 1)
      assert.equal(full.current.state, 'published')
      const def = full.current.definition
      assert.deepEqual(
        def.sections.map((s) => [s.number, s.title, rowsOf(s)]),
        expected.sections,
        `${t.vehicleType} (PDF page ${expected.page})`,
      )
      assert.equal(def.header.companyName, 'MASHHOR GENERAL CONTRACTOR SDN BHD')
      assert.equal(def.header.subtitle, 'LEASING SERVICES FOR THE ROYAL BRUNEI ARMED FORCES AND MINISTRY OF DEFENCE PROJECT')
      assert.deepEqual(def.details.map((d) => [d.key, d.default]), [
        ['model', expected.model],
        ['mileage', ''],
        ['date', ''],
        ['location', ''],
        ['divProject', 'Berakas Office / MINDEF Project'],
      ])
      assert.deepEqual(def.statusLegend, [
        { value: '/', label: 'Satisfactory' },
        { value: 'x', label: 'Defect' },
        { value: 'N/A', label: 'Not Applicable' },
        { value: 'M', label: 'Missing' },
      ])
      assert.equal(def.footer.remarks, true)
      assert.equal(def.footer.nextServicing, expected.nextServicing, `${t.vehicleType} next servicing line`)
      assert.deepEqual(def.signoff, {
        checked_by: { caption: 'MGCSB, Inspector', printedName: '' },
        agreed_by: { caption: 'MINDEF', printedName: '' },
        approved_by: { caption: 'Head of Operations', printedName: 'Ali Hj Abd Rahman' },
      })
      assert.equal(def.damage.enabled, true)
      assert.deepEqual(def.damage.extentOptions, ['None', 'Minor', 'Extensive', 'Beyond Repair'])
      const diagram = (await adm('GET', '/checklist-diagrams')).body.diagrams.find((d) => d.id === def.damage.diagramId)
      assert.equal(diagram.vehicleType, t.vehicleType, 'each form uses its own vehicle diagram')
      assert.match(diagram.source, new RegExp(`page ${expected.page + 1}$`))
      // Tyre measurements: tread depth (MM) and inflation pressure (PSI) at four positions.
      const tyre = def.sections[0].items.find((i) => i.label === 'Tire ;')
      assert.deepEqual(tyre.measurements.map((m) => [m.label, m.unit, m.layout]), [
        ['Tread Depth', 'MM', 'axle'],
        ['Inflation Pressure', 'PSI', 'axle'],
      ])
      const voltage = def.sections[1].items.find((i) => i.label === 'Battery Voltage')
      assert.deepEqual(voltage.measurements.map((m) => [m.layout, m.unit]), [['single', '']], 'no unit is printed on the form')
    }
  })

  it('re-running the import creates no duplicates and keeps staff changes', async () => {
    const t = await templateFor('FORKLIFT')
    const full = (await adm('GET', `/checklist-templates/${t.id}`)).body
    const changed = structuredClone(full.current.definition)
    changed.details.find((d) => d.key === 'divProject').default = 'TEST changed project'
    assert.equal((await adm('PUT', `/checklist-templates/${t.id}/draft`, { definition: changed })).status, 200)
    assert.equal((await adm('POST', `/checklist-templates/${t.id}/publish`)).status, 200)
    const counts = () => [
      server.db.prepare('SELECT COUNT(*) AS n FROM checklist_templates').get().n,
      server.db.prepare('SELECT COUNT(*) AS n FROM checklist_template_versions').get().n,
      server.db.prepare('SELECT COUNT(*) AS n FROM checklist_diagrams').get().n,
    ]
    const beforeCounts = counts()
    const report = runChecklistImport(server.db)
    assert.deepEqual(counts(), beforeCounts)
    assert.equal(report.created.length, 0)
    assert.equal(report.unchanged.length, 4)
    const current = (await adm('GET', `/checklist-templates/${t.id}`)).body.current
    assert.equal(current.version, 2)
    assert.equal(current.definition.details.find((d) => d.key === 'divProject').default, 'TEST changed project')
    // Restore the source default as version 3.
    changed.details.find((d) => d.key === 'divProject').default = 'Berakas Office / MINDEF Project'
    await adm('PUT', `/checklist-templates/${t.id}/draft`, { definition: changed })
    await adm('POST', `/checklist-templates/${t.id}/publish`)
  })

  it('published versions are frozen; drafts can be saved, discarded and published', async () => {
    const t = await templateFor('MEDIUM BUS')
    const v1 = server.db.prepare("SELECT id FROM checklist_template_versions WHERE template_id = ? AND version = 1").get(t.id)
    assert.throws(() => server.db.prepare("UPDATE checklist_template_versions SET definition = '{}' WHERE id = ?").run(v1.id), /cannot be changed/)
    assert.throws(() => server.db.prepare('DELETE FROM checklist_template_versions WHERE id = ?').run(v1.id), /cannot be deleted/)
    const full = (await adm('GET', `/checklist-templates/${t.id}`)).body
    const def = structuredClone(full.current.definition)
    def.sections[0].items[0].label = 'TEST relabelled'
    const draft = await adm('PUT', `/checklist-templates/${t.id}/draft`, { definition: def })
    assert.equal(draft.body.draft.version, 2)
    assert.equal((await adm('DELETE', `/checklist-templates/${t.id}/draft`)).status, 200)
    assert.equal((await adm('GET', `/checklist-templates/${t.id}`)).body.draft, null)
    assert.equal((await adm('POST', `/checklist-templates/${t.id}/publish`)).status, 409, 'nothing to publish')
    // Invalid definitions are refused with a readable message.
    const dup = structuredClone(full.current.definition)
    dup.sections[0].items[1].key = dup.sections[0].items[0].key
    const bad = await adm('PUT', `/checklist-templates/${t.id}/draft`, { definition: dup })
    assert.equal(bad.status, 400)
    assert.match(bad.body.error, /Duplicate key/)
    const badDiagram = structuredClone(full.current.definition)
    badDiagram.damage.diagramId = 9999
    assert.equal((await adm('PUT', `/checklist-templates/${t.id}/draft`, { definition: badDiagram })).status, 400)
  })

  it('a new inspection starts with only the configured defaults — nothing is pre-selected', async () => {
    const insp = await newInspection('FORKLIFT')
    assert.equal(insp.templateVersion, 3)
    assert.deepEqual(insp.working.answers.details, { model: 'Forklift', divProject: 'Berakas Office / MINDEF Project' })
    assert.deepEqual(insp.working.answers.items, {}, 'no status is selected automatically')
    assert.equal(insp.working.answers.damage.extent, null)
    ids.flow = insp.id
  })

  it('saves and restores a draft with measurements, remarks/actions and damage markers', async () => {
    const id = ids.flow
    const answers = {
      details: { model: 'Forklift', mileage: '1520', date: '2026-11-14', location: 'TEST yard', divProject: 'Berakas Office / MINDEF Project' },
      items: {
        'fl-1.1': { status: '/' },
        'fl-1.3': {
          status: 'x',
          remark: 'TEST front left tyre worn',
          action: 'TEST replace tyre',
          measurements: { tread: { front_r: '6', front_l: '2.5', rear_r: '7', rear_l: '7' }, pressure: { front_r: '32', rear_l: '30' } },
        },
        'fl-2.6': { status: '/', measurements: { voltage: { value: '12.6' } } },
        'fl-3.9-4': { status: 'M', remark: 'TEST warning light missing' },
      },
      remarks: 'TEST general comment',
      nextServicing: 'TEST at 2000 KM',
      damage: { extent: 'Minor', notes: 'TEST scratches', markers: [{ id: 'm1', x: 0.25, y: 0.5, note: 'TEST dent on mast' }] },
    }
    const saved = await api(as.insp, 'PUT', `/inspections/${id}/form`, { answers })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    const reopened = (await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection
    assert.deepEqual(reopened.working.answers, answers, 'draft is restored exactly')
    assert.equal(reopened.status, 'draft')
    // Summary lists only items with a remark/action, identified by vehicle and item.
    assert.deepEqual(
      reopened.working.summary.map((s) => [s.number, s.label, s.status, s.remark, s.action, s.vehicle.modRegistrationNo]),
      [
        ['1.3', 'Tire ;', 'x', 'TEST front left tyre worn', 'TEST replace tyre', 'MOD TEST-1'],
        ['3.9', 'Lights : – Warning Light', 'M', 'TEST warning light missing', '', 'MOD TEST-1'],
      ],
    )
  })

  it('refuses malformed answers', async () => {
    const id = ids.flow
    const put = (answers) => api(as.insp, 'PUT', `/inspections/${id}/form`, { answers })
    assert.equal((await put({ items: { 'fl-1.3': { measurements: { tread: { front_r: 'abc' } } } } })).status, 400, 'measurement must be a number')
    assert.equal((await put({ items: { 'fl-1.3': { measurements: { tread: { middle: '3' } } } } })).status, 400, 'unknown position')
    assert.equal((await put({ items: { 'fl-3.9': { status: '/' } } })).status, 400, 'a group heading takes no status')
    assert.equal((await put({ items: { 'nope': { status: '/' } } })).status, 400, 'unknown item')
    assert.equal((await put({ items: { 'fl-1.1': { status: 'OK' } } })).status, 400, 'status must be on the legend')
    assert.equal((await put({ damage: { markers: [{ id: 'm1', x: 1.5, y: 0.2 }] } })).status, 400, 'marker outside the diagram')
    assert.equal((await put({ damage: { extent: 'Total' } })).status, 400)
    assert.equal((await put({ details: { date: '14/11/2026' } })).status, 400)
    assert.equal((await put({ details: { colour: 'red' } })).status, 400)
    // The valid draft from the previous test is untouched.
    const d = (await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection
    assert.equal(d.working.answers.items['fl-1.3'].measurements.tread.front_l, '2.5')
  })

  it('submission requires every applicable field; unanswered is never treated as satisfactory', async () => {
    const id = ids.flow
    const res = await api(as.insp, 'POST', `/inspections/${id}/submit`, {})
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'INCOMPLETE')
    const fields = res.body.problems.map((p) => p.field)
    assert.ok(fields.includes('item.fl-1.2.status'))
    assert.ok(fields.includes('item.fl-3.9-1.status'), 'nested items need a status too')
    assert.ok(!fields.includes('item.fl-3.9.status'), 'the group heading does not')
    assert.ok(!fields.some((f) => f.startsWith('details.')), 'details already entered')
    // Missing detail and damage extent are reported as well.
    const def = (await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection.working.definition
    const partial = completeAnswers(def, { damage: { extent: null, notes: '', markers: [] } })
    delete partial.details.location
    const res2 = await api(as.insp, 'POST', `/inspections/${id}/submit`, { answers: partial })
    assert.deepEqual(res2.body.problems.map((p) => p.field), ['details.location', 'damage.extent'])
    assert.equal((await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection.status, 'draft')
  })

  it('a marker note alone makes acknowledgement pending; the frozen revision keeps every answer', async () => {
    const id = ids.flow
    const def = (await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection.working.definition
    const answers = completeAnswers(def, {
      damage: { extent: 'Minor', notes: '', markers: [{ id: 'm1', x: 0.3, y: 0.4, note: 'TEST scratch near fork' }] },
    })
    answers.items['fl-1.3'] = { status: '/', measurements: { tread: { front_r: '8', front_l: '8', rear_r: '8', rear_l: '8' } } }
    const res = await api(as.insp, 'POST', `/inspections/${id}/submit`, { answers })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const d = (await api(as.cli, 'GET', `/inspections/${id}`)).body.inspection
    assert.equal(d.status, 'pending_verification')
    const rev = d.revisions.find((r) => r.current)
    assert.equal(rev.acknowledgement, 'pending')
    assert.equal(rev.snapshot.templateVersion, 3)
    assert.deepEqual(rev.snapshot.answers, answers)
    assert.equal(rev.snapshot.vehicle.modRegistrationNo, 'MOD TEST-1')
    assert.deepEqual(rev.summary, [], 'no item remarks/actions → empty summary')
    // The revision cannot be altered in the database either.
    const row = server.db.prepare('SELECT id FROM inspection_revisions WHERE inspection_id = ? AND revision = 1').get(id)
    assert.throws(() => server.db.prepare("UPDATE inspection_revisions SET snapshot = '{}' WHERE id = ?").run(row.id), /cannot be changed/)
    assert.throws(() => server.db.prepare('DELETE FROM inspection_revisions WHERE id = ?').run(row.id), /cannot be deleted/)
  })

  it('re-check → corrected resubmission keeps revision 1 exactly as reviewed', async () => {
    const id = ids.flow
    assert.equal((await api(as.cli, 'POST', `/inspections/${id}/recheck`, { revision: 1, reason: 'TEST: re-measure the front left tyre.' })).status, 200)
    const working = (await api(as.insp, 'GET', `/inspections/${id}`)).body.inspection.working
    const answers = structuredClone(working.answers)
    answers.items['fl-1.3'].measurements.tread.front_l = '3'
    answers.items['fl-1.3'].remark = 'TEST tread low'
    answers.damage.markers = []
    const res = await api(as.insp, 'POST', `/inspections/${id}/submit`, { answers })
    assert.equal(res.status, 200)
    const rev1 = (await api(as.cli, 'GET', `/inspections/${id}/revisions/1`)).body.revision
    const rev2 = (await api(as.cli, 'GET', `/inspections/${id}/revisions/2`)).body.revision
    assert.equal(rev1.snapshot.answers.items['fl-1.3'].measurements.tread.front_l, '8')
    assert.equal(rev1.snapshot.answers.damage.markers.length, 1)
    assert.equal(rev2.snapshot.answers.items['fl-1.3'].measurements.tread.front_l, '3')
    assert.equal(rev2.current, true)
    assert.equal(rev2.acknowledgement, 'pending', 'item remark → pending')
    assert.equal((await api(as.cli, 'GET', `/inspections/${id}/revisions/3`)).status, 404)
    assert.equal((await api(as.clib, 'GET', `/inspections/${id}/revisions/1`)).status, 404, 'other company')
  })

  it('no remarks → auto-acknowledged, but never auto-approved', async () => {
    const insp = await newInspection('LARGE BUS')
    const def = insp.working.definition
    const answers = completeAnswers(def)
    answers.details.model = 'Ankai (Large Bus 45 seaters)'
    const res = await api(as.insp, 'POST', `/inspections/${insp.id}/submit`, { answers })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const d = (await api(as.cli, 'GET', `/inspections/${insp.id}`)).body.inspection
    assert.equal(d.revisions[0].acknowledgement, 'auto')
    assert.equal(d.status, 'pending_verification')
    assert.equal(d.approvedAt, null)
    assert.ok(!def.footer.nextServicing && answers.nextServicing === '')
  })

  it('serves only the diagrams an inspection uses, to people who may see it', async () => {
    const d = (await api(as.insp, 'GET', `/inspections/${ids.flow}`)).body.inspection
    const diagramId = d.working.definition.damage.diagramId
    const img = await as.insp.raw(`/api/mashoor/portal/inspections/${ids.flow}/diagrams/${diagramId}`)
    assert.equal(img.status, 200)
    assert.equal(img.headers.get('content-type'), 'image/jpeg')
    assert.ok(img.bytes.length > 10000)
    const other = (await adm('GET', '/checklist-diagrams')).body.diagrams.find((x) => x.id !== diagramId)
    assert.equal((await as.insp.raw(`/api/mashoor/portal/inspections/${ids.flow}/diagrams/${other.id}`)).status, 404, 'not this inspection’s diagram')
    assert.equal((await as.clib.raw(`/api/mashoor/portal/inspections/${ids.flow}/diagrams/${diagramId}`)).status, 404, 'other company')
    assert.equal((await new Client(server.baseUrl).raw(`/api/mashoor/portal/inspections/${ids.flow}/diagrams/${diagramId}`)).status, 401)
    assert.equal((await staff.raw(`/api/mashoor/admin/checklist-diagrams/${diagramId}/image`)).status, 200)
  })

  it('staff can upload a diagram image (PNG/JPEG/WebP only)', async () => {
    const upload = async (bytes, type, name = 'TEST diagram') => {
      const form = new FormData()
      form.append('image', new Blob([bytes], { type }), 'd.bin')
      const res = await fetch(`${server.baseUrl}/api/mashoor/admin/checklist-diagrams?name=${encodeURIComponent(name)}&vehicleType=FORKLIFT`, {
        method: 'POST',
        headers: { origin: APP_ORIGIN, cookie: [...staff.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
        body: form,
      })
      return { status: res.status, body: await res.json() }
    }
    const ok = await upload(TINY_PNG, 'image/png')
    assert.equal(ok.status, 201, JSON.stringify(ok.body))
    assert.equal(ok.body.diagram.builtIn, false)
    assert.equal((await staff.raw(`/api/mashoor/admin/checklist-diagrams/${ok.body.diagram.id}/image`)).status, 200)
    assert.equal((await upload(Buffer.from('GIF89a........'), 'image/gif')).status, 400)
    assert.equal((await upload(Buffer.from('not an image at all'), 'image/png')).status, 400)
  })

  it('inspection settings show the template sign-off captions as guidance', async () => {
    const res = await adm('GET', `/vendors/${ids.companyA}/inspection-settings`)
    assert.deepEqual(res.body.templateCaptions, {
      checked_by: ['(MGCSB, Inspector)'],
      agreed_by: ['(MINDEF)'],
      approved_by: ['Ali Hj Abd Rahman (Head of Operations)'],
    })
    assert.ok(res.body.signatories.every((s) => s.assignee === null), 'nothing is assigned from the labels')
  })

  it('0005 inspections and templates keep working through the compatibility layer', async () => {
    const db = server.db
    // A template and an inspection exactly as 0005 stored them.
    const tId = Number(
      db.prepare("INSERT INTO checklist_templates (vehicle_type, name, status_options) VALUES ('MEDIUM BUS', 'TEST legacy', ?)").run(JSON.stringify(['Good', 'Bad']))
        .lastInsertRowid,
    )
    db.prepare("INSERT INTO checklist_template_items (template_id, position, section, label) VALUES (?, 1, 'TEST S', 'TEST legacy item 1'), (?, 2, 'TEST S', 'TEST legacy item 2')").run(tId, tId)
    const iId = Number(
      db
        .prepare(
          `INSERT INTO inspections (company_id, inspector_id, template_id, template_name, status_options, vehicle_type, vehicle_plate, status)
           VALUES (?, ?, ?, 'TEST legacy', ?, 'MEDIUM BUS', 'LEG 1', 'draft')`,
        )
        .run(ids.companyA, ids.inspector, tId, JSON.stringify(['Good', 'Bad'])).lastInsertRowid,
    )
    db.prepare("INSERT INTO inspection_items (inspection_id, position, section, label, status, remark) VALUES (?, 1, 'TEST S', 'TEST legacy item 1', 'Good', 'TEST old remark'), (?, 2, 'TEST S', 'TEST legacy item 2', NULL, NULL)").run(iId, iId)
    const itemIds = db.prepare('SELECT id FROM inspection_items WHERE inspection_id = ? ORDER BY position').all(iId).map((r) => r.id)

    const before = (await api(as.insp, 'GET', `/inspections/${iId}`)).body.inspection
    assert.equal(before.working.definition.legacy, true)
    assert.deepEqual(before.working.answers.items, { [`legacy-${itemIds[0]}`]: { status: 'Good', remark: 'TEST old remark' } })
    const answers = { items: { [`legacy-${itemIds[0]}`]: { status: 'Good', remark: 'TEST old remark' }, [`legacy-${itemIds[1]}`]: { status: 'Bad' } } }
    const res = await api(as.insp, 'POST', `/inspections/${iId}/submit`, { answers })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const rev = res.body.inspection.revisions[0]
    assert.equal(rev.acknowledgement, 'pending')
    assert.equal(rev.summary[0].remark, 'TEST old remark')
    // Old item rows are left exactly as they were.
    assert.equal(db.prepare('SELECT status FROM inspection_items WHERE id = ?').get(itemIds[1]).status, null)

    // A 0005-format revision snapshot is still readable.
    const legacySnapshot = JSON.stringify({
      vehicle: { type: 'MEDIUM BUS', plate: 'LEG 1', registrationNo: null, modRegistrationNo: null },
      templateName: 'TEST legacy',
      statusOptions: ['Good', 'Bad'],
      items: [{ id: 77, position: 1, section: 'TEST S', label: 'TEST frozen item', status: 'Bad', remark: 'TEST frozen remark', action: '' }],
    })
    db.prepare("INSERT INTO inspection_revisions (inspection_id, revision, snapshot, has_remarks, acknowledgement, submitted_by) VALUES (?, 2, ?, 1, 'pending', ?)").run(
      iId,
      legacySnapshot,
      ids.inspector,
    )
    const old = (await api(as.cli, 'GET', `/inspections/${iId}/revisions/2`)).body.revision
    assert.equal(old.snapshot.definition.sections[0].items[0].label, 'TEST frozen item')
    assert.deepEqual(old.snapshot.answers.items['legacy-77'], { status: 'Bad', remark: 'TEST frozen remark' })

    // The import step turns the legacy template into a published version 1.
    const report = runChecklistImport(db)
    assert.deepEqual(report.upgraded, ['TEST legacy'])
    const t = (await adm('GET', `/checklist-templates/${tId}`)).body
    assert.equal(t.current.version, 1)
    assert.deepEqual(t.current.definition.sections[0].items.map((i) => i.label), ['TEST legacy item 1', 'TEST legacy item 2'])
  })
})
