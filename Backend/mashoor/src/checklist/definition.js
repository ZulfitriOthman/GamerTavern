// Checklist form definitions (template versions) and inspection answers.
//
// A DEFINITION describes one paper checklist as data:
//   header        document heading (company, title, project line, logos on/off)
//   details       vehicle-detail fields (Model, Mileage (KM), Date, Location,
//                 Div. / Project) with configurable defaults and required flags
//   statusLegend  the marks an item can take, e.g. "/" = Satisfactory
//   sections      numbered sections → items → nested items; an item may carry
//                 a status, measurement fields (with units and front/rear,
//                 right/left positions) or only group nested items
//   footer        Remarks / Comments and Next Servicing on/off
//   signoff       captions printed under Checked by / Agreed by / Approved by
//   damage        damage-diagram page: diagram id, note, extent options
//
// ANSWERS are what the inspector enters for one inspection. Nothing is ever
// pre-selected: an item without a status is unanswered, never "satisfactory".
//
// Everything here is pure (no database access) so it can be used by routes,
// the seed import and tests alike.

export const DETAIL_FIELDS = {
  model: 'Model',
  mileage: 'Mileage (KM)',
  date: 'Date',
  location: 'Location',
  divProject: 'Div. / Project',
}
export const MEASUREMENT_LAYOUTS = {
  // Four wheel positions as printed on the checklist: "Front: R  L | Rear: R  L".
  axle: [
    ['front_r', 'Front R'],
    ['front_l', 'Front L'],
    ['rear_r', 'Rear R'],
    ['rear_l', 'Rear L'],
  ],
  single: [['value', '']],
}
export const EXTENT_OPTIONS = ['None', 'Minor', 'Extensive', 'Beyond Repair']
export const SIGNOFF_STAGES = ['checked_by', 'agreed_by', 'approved_by']

export const LIMITS = {
  sections: 40,
  itemsPerSection: 80,
  children: 40,
  measurements: 4,
  legend: 10,
  markers: 60,
  text: 1000, // remark / action / marker note
  longText: 4000, // general remarks, damage notes, next servicing
}

const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const NUMBER = /^-?\d{1,9}(\.\d{1,3})?$/

export class DefinitionError extends Error {}
export class AnswerError extends Error {}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function str(value, max, what, Err = DefinitionError) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Err(`${what} must be text.`)
  const clean = value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
  if (clean.length > max) throw new Err(`${what} is too long (max ${max} characters).`)
  return clean
}

function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') throw new DefinitionError('Expected true or false.')
  return value
}

function list(value, max, what) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new DefinitionError(`${what} must be a list.`)
  if (value.length > max) throw new DefinitionError(`${what}: at most ${max} allowed.`)
  return value
}

function key(value, what, used) {
  if (typeof value !== 'string' || !KEY.test(value)) throw new DefinitionError(`${what} has an invalid key.`)
  if (used.has(value)) throw new DefinitionError(`Duplicate key “${value}”.`)
  used.add(value)
  return value
}

function normalizeMeasurement(input, where, used) {
  if (!isObject(input)) throw new DefinitionError(`${where}: each measurement must be an object.`)
  const layout = input.layout ?? 'axle'
  if (!MEASUREMENT_LAYOUTS[layout]) throw new DefinitionError(`${where}: measurement layout must be “axle” or “single”.`)
  return {
    key: key(input.key, `${where} measurement`, used),
    label: str(input.label, 80, `${where} measurement label`),
    unit: str(input.unit, 16, `${where} measurement unit`),
    layout,
    required: bool(input.required, false),
  }
}

function normalizeItem(input, where, used, { allowChildren }) {
  if (!isObject(input)) throw new DefinitionError(`${where}: each item must be an object.`)
  const label = str(input.label, 200, `${where} label`)
  if (!label) throw new DefinitionError(`${where}: the item label is required.`)
  const measurementKeys = new Set()
  const item = {
    key: key(input.key, where, used),
    number: str(input.number, 12, `${where} number`),
    label,
    status: bool(input.status, true),
    measurements: list(input.measurements, LIMITS.measurements, `${where} measurements`).map((m) =>
      normalizeMeasurement(m, `${where} (${label})`, measurementKeys),
    ),
  }
  const children = list(input.children, LIMITS.children, `${where} nested items`)
  if (children.length && !allowChildren) throw new DefinitionError(`${where}: nested items cannot have their own nested items.`)
  if (allowChildren) {
    item.children = children.map((child, i) => normalizeItem(child, `${where} › nested item ${i + 1}`, used, { allowChildren: false }))
  }
  return item
}

/**
 * Validates and canonicalises a definition. Throws DefinitionError with a
 * message fit for staff. `diagramExists(id)` checks a referenced diagram.
 */
export function normalizeDefinition(input, { diagramExists = () => true } = {}) {
  if (!isObject(input)) throw new DefinitionError('The template definition must be an object.')
  const header = isObject(input.header) ? input.header : {}
  const details = list(input.details, Object.keys(DETAIL_FIELDS).length, 'Vehicle details')
  const seenDetail = new Set()
  const legend = list(input.statusLegend, LIMITS.legend, 'Status legend')
  const legendValues = new Set()
  const used = new Set()
  const footer = isObject(input.footer) ? input.footer : {}
  const signoff = isObject(input.signoff) ? input.signoff : {}
  const damage = isObject(input.damage) ? input.damage : {}

  const def = {
    header: {
      companyName: str(header.companyName, 120, 'Company name'),
      title: str(header.title, 120, 'Title'),
      subtitle: str(header.subtitle, 300, 'Project heading'),
      showLogos: bool(header.showLogos, false),
    },
    details: details.map((d, i) => {
      if (!isObject(d) || !DETAIL_FIELDS[d.key]) throw new DefinitionError(`Vehicle detail ${i + 1}: unknown field.`)
      if (seenDetail.has(d.key)) throw new DefinitionError(`Vehicle detail “${DETAIL_FIELDS[d.key]}” is listed twice.`)
      seenDetail.add(d.key)
      const fallback = str(d.default, 200, `${DETAIL_FIELDS[d.key]} default`)
      if (d.key === 'date' && fallback && !DATE.test(fallback)) throw new DefinitionError('The Date default must be empty or YYYY-MM-DD.')
      if (d.key === 'mileage' && fallback && !NUMBER.test(fallback)) throw new DefinitionError('The Mileage default must be empty or a number.')
      return { key: d.key, default: fallback, required: bool(d.required, false) }
    }),
    statusLegend: legend.map((entry, i) => {
      if (!isObject(entry)) throw new DefinitionError(`Status legend entry ${i + 1} must be an object.`)
      const value = str(entry.value, 12, `Status legend entry ${i + 1} mark`)
      const label = str(entry.label, 60, `Status legend entry ${i + 1} meaning`)
      if (!value || !label) throw new DefinitionError(`Status legend entry ${i + 1} needs a mark and its meaning.`)
      if (legendValues.has(value)) throw new DefinitionError(`Status mark “${value}” is listed twice.`)
      legendValues.add(value)
      return { value, label }
    }),
    sections: list(input.sections, LIMITS.sections, 'Sections').map((section, s) => {
      if (!isObject(section)) throw new DefinitionError(`Section ${s + 1} must be an object.`)
      const where = `Section ${section.number || s + 1}`
      const column = section.column === 2 ? 2 : section.column === 1 || section.column === undefined ? 1 : null
      if (!column) throw new DefinitionError(`${where}: print column must be 1 or 2.`)
      return {
        key: key(section.key, where, used),
        number: str(section.number, 12, `${where} number`),
        title: str(section.title, 160, `${where} title`),
        column,
        items: list(section.items, LIMITS.itemsPerSection, `${where} items`).map((item, i) =>
          normalizeItem(item, `${where}, item ${item?.number || i + 1}`, used, { allowChildren: true }),
        ),
      }
    }),
    footer: { remarks: bool(footer.remarks, true), nextServicing: bool(footer.nextServicing, false) },
    signoff: Object.fromEntries(
      SIGNOFF_STAGES.map((stage) => {
        const s = isObject(signoff[stage]) ? signoff[stage] : {}
        return [stage, { caption: str(s.caption, 120, 'Sign-off caption'), printedName: str(s.printedName, 120, 'Sign-off printed name') }]
      }),
    ),
    damage: {
      enabled: bool(damage.enabled, false),
      diagramId: damage.diagramId === null || damage.diagramId === undefined || damage.diagramId === '' ? null : Number(damage.diagramId),
      note: str(damage.note, 300, 'Damage diagram note'),
      extentOptions: [...EXTENT_OPTIONS],
    },
    source: str(input.source, 300, 'Source'),
  }
  if (def.damage.diagramId !== null && (!Number.isSafeInteger(def.damage.diagramId) || def.damage.diagramId < 1 || !diagramExists(def.damage.diagramId))) {
    throw new DefinitionError('The chosen damage diagram does not exist.')
  }
  if (input.legacy === true) def.legacy = true
  return def
}

/** Problems that block publishing (a draft may be incomplete). */
export function publishProblems(def) {
  const problems = []
  if (!def.statusLegend.length) problems.push('Add at least one status mark to the legend.')
  if (!allItems(def).some(({ item }) => item.status || item.measurements.length)) problems.push('Add at least one checklist item.')
  if (def.damage.enabled && !def.damage.diagramId) problems.push('Choose a damage diagram, or turn the damage assessment off.')
  return problems
}

/** Every item in display order: { item, parent, section }. */
export function allItems(def) {
  const out = []
  for (const section of def.sections) {
    for (const item of section.items) {
      out.push({ item, parent: null, section })
      for (const child of item.children ?? []) out.push({ item: child, parent: item, section })
    }
  }
  return out
}

export function itemCount(def) {
  return allItems(def).filter(({ item }) => item.status || item.measurements.length).length
}

// ---- Answers -----------------------------------------------------------------

/** A new inspection's answers: only the template's configured detail defaults. */
export function initialAnswers(def) {
  const details = {}
  for (const d of def.details) if (d.default) details[d.key] = d.default
  return { details, items: {}, remarks: '', nextServicing: '', damage: { extent: null, notes: '', markers: [] } }
}

function measurementValue(raw, what) {
  if (raw === undefined || raw === null || raw === '') return ''
  const value = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw
  if (typeof value !== 'string') throw new AnswerError(`${what} must be a number.`)
  const clean = value.trim()
  if (clean === '') return ''
  if (!NUMBER.test(clean)) throw new AnswerError(`${what} must be a number (e.g. 8 or 32.5).`)
  return clean
}

/**
 * Validates what the inspector sends against the inspection's own definition
 * and returns the canonical answers object. Unknown items/fields are refused.
 */
export function normalizeAnswers(def, input) {
  if (!isObject(input)) throw new AnswerError('answers must be an object.')
  const legend = new Set(def.statusLegend.map((s) => s.value))
  const byKey = new Map(allItems(def).map((entry) => [entry.item.key, entry.item]))
  const detailKeys = new Map(def.details.map((d) => [d.key, d]))

  const details = {}
  const inDetails = input.details ?? {}
  if (!isObject(inDetails)) throw new AnswerError('details must be an object.')
  for (const [k, raw] of Object.entries(inDetails)) {
    if (!detailKeys.has(k)) throw new AnswerError(`Unknown vehicle detail “${k}”.`)
    const label = DETAIL_FIELDS[k]
    let value = str(raw, 200, label, AnswerError)
    if (k === 'date' && value && !DATE.test(value)) throw new AnswerError('Date must be a valid date.')
    if (k === 'date' && value && Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new AnswerError('Date must be a valid date.')
    if (k === 'mileage' && value) value = measurementValue(value, label)
    if (value) details[k] = value
  }

  const items = {}
  const inItems = input.items ?? {}
  if (!isObject(inItems)) throw new AnswerError('items must be an object.')
  for (const [k, raw] of Object.entries(inItems)) {
    const item = byKey.get(k)
    if (!item) throw new AnswerError('Unknown checklist item.')
    if (!isObject(raw)) throw new AnswerError('Each checklist answer must be an object.')
    const where = `${item.number ? `${item.number} ` : ''}${item.label}`
    const answer = {}
    if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
      if (!item.status) throw new AnswerError(`${where} does not take a status.`)
      if (typeof raw.status !== 'string' || !legend.has(raw.status)) throw new AnswerError(`“${raw.status}” is not a status mark on this checklist.`)
      answer.status = raw.status
    }
    const remark = str(raw.remark, LIMITS.text, `Remark for ${where}`, AnswerError)
    const action = str(raw.action, LIMITS.text, `Action for ${where}`, AnswerError)
    if (remark) answer.remark = remark
    if (action) answer.action = action
    if (raw.measurements !== undefined && raw.measurements !== null) {
      if (!isObject(raw.measurements)) throw new AnswerError(`Measurements for ${where} must be an object.`)
      const fields = new Map(item.measurements.map((m) => [m.key, m]))
      for (const [mk, values] of Object.entries(raw.measurements)) {
        const field = fields.get(mk)
        if (!field) throw new AnswerError(`Unknown measurement for ${where}.`)
        if (!isObject(values)) throw new AnswerError(`Measurement values for ${where} must be an object.`)
        const positions = new Map(MEASUREMENT_LAYOUTS[field.layout])
        const out = {}
        for (const [pos, v] of Object.entries(values)) {
          if (!positions.has(pos)) throw new AnswerError(`Unknown measurement position for ${where}.`)
          const clean = measurementValue(v, `${field.label || where} ${positions.get(pos)}`.trim())
          if (clean) out[pos] = clean
        }
        if (Object.keys(out).length) answer.measurements = { ...answer.measurements, [mk]: out }
      }
    }
    if (Object.keys(answer).length) items[k] = answer
  }

  const damageIn = input.damage ?? {}
  if (!isObject(damageIn)) throw new AnswerError('damage must be an object.')
  const damage = { extent: null, notes: '', markers: [] }
  if (def.damage.enabled) {
    if (damageIn.extent !== undefined && damageIn.extent !== null && damageIn.extent !== '') {
      if (!def.damage.extentOptions.includes(damageIn.extent)) throw new AnswerError('Choose a valid extent of damage.')
      damage.extent = damageIn.extent
    }
    damage.notes = str(damageIn.notes, LIMITS.longText, 'Damage notes / remarks', AnswerError)
    const markers = damageIn.markers ?? []
    if (!Array.isArray(markers) || markers.length > LIMITS.markers) throw new AnswerError(`Up to ${LIMITS.markers} damage markers are allowed.`)
    const ids = new Set()
    damage.markers = markers.map((m, i) => {
      if (!isObject(m)) throw new AnswerError('Each damage marker must be an object.')
      const id = typeof m.id === 'string' && KEY.test(m.id) ? m.id : null
      if (!id || ids.has(id)) throw new AnswerError(`Damage marker ${i + 1} has an invalid id.`)
      ids.add(id)
      const x = Number(m.x)
      const y = Number(m.y)
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new AnswerError(`Damage marker ${i + 1} is outside the diagram.`)
      }
      return { id, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, note: str(m.note, LIMITS.text, `Damage marker ${i + 1} note`, AnswerError) }
    })
  }

  return {
    details,
    items,
    remarks: def.footer.remarks ? str(input.remarks, LIMITS.longText, 'Remarks / Comments', AnswerError) : '',
    nextServicing: def.footer.nextServicing ? str(input.nextServicing, LIMITS.longText, 'Next Servicing', AnswerError) : '',
    damage,
  }
}

/** Anything still missing before the checklist may be submitted: [{ field, message }]. */
export function submitProblems(def, answers) {
  const problems = []
  for (const d of def.details) {
    if (d.required && !answers.details?.[d.key]) problems.push({ field: `details.${d.key}`, message: `${DETAIL_FIELDS[d.key]} is required.` })
  }
  for (const { item } of allItems(def)) {
    const answer = answers.items?.[item.key] ?? {}
    const name = `${item.number ? `${item.number} ` : ''}${item.label}`
    if (item.status && !answer.status) problems.push({ field: `item.${item.key}.status`, message: `${name}: choose a status.` })
    for (const m of item.measurements) {
      if (!m.required) continue
      for (const [pos, posLabel] of MEASUREMENT_LAYOUTS[m.layout]) {
        if (!answer.measurements?.[m.key]?.[pos]) {
          problems.push({ field: `item.${item.key}.m.${m.key}.${pos}`, message: `${name}: enter ${[m.label, posLabel].filter(Boolean).join(' ')}.` })
        }
      }
    }
  }
  if (def.damage.enabled && !answers.damage?.extent) problems.push({ field: 'damage.extent', message: 'Choose the extent of damage (None if there is none).' })
  return problems
}

/**
 * Whether the revision needs acknowledgement: any remark text anywhere — an
 * item remark, the general Remarks / Comments, the damage notes or a damage
 * marker note. Actions and Next Servicing alone are not remarks.
 */
export function hasRemarks(answers) {
  if (Object.values(answers.items ?? {}).some((a) => (a.remark ?? '').trim())) return true
  if ((answers.remarks ?? '').trim()) return true
  if ((answers.damage?.notes ?? '').trim()) return true
  return (answers.damage?.markers ?? []).some((m) => (m.note ?? '').trim())
}

/** Summary = exactly the items carrying a remark or an action, as entered. */
export function buildSummary(vehicle, def, answers) {
  const legend = new Map(def.statusLegend.map((s) => [s.value, s.label]))
  return allItems(def)
    .map(({ item, parent, section }) => ({ item, parent, section, answer: answers.items?.[item.key] ?? {} }))
    .filter(({ answer }) => (answer.remark ?? '').trim() || (answer.action ?? '').trim())
    .map(({ item, parent, section, answer }) => ({
      vehicle,
      itemKey: item.key,
      number: item.number || parent?.number || '',
      label: parent ? `${parent.label} – ${item.label}` : item.label,
      section: [section.number, section.title].filter(Boolean).join(' '),
      status: answer.status ?? null,
      statusLabel: answer.status ? legend.get(answer.status) ?? answer.status : null,
      remark: answer.remark ?? '',
      action: answer.action ?? '',
    }))
}

// ---- 0005 compatibility ------------------------------------------------------
// Inspections and templates created before 0006 have a flat item list and a
// list of status labels. They are presented through the same definition shape;
// their keys come from the old row ids so answers stay attached to the same item.

export function legacyDefinition(statusOptions, rows, { idOf = (row) => row.id } = {}) {
  const sections = []
  for (const row of rows) {
    const title = row.section ?? ''
    let section = sections[sections.length - 1]
    if (!section || section.title !== title) {
      section = { key: `legacy-s${sections.length + 1}`, number: '', title, column: 1, items: [] }
      sections.push(section)
    }
    section.items.push({ key: `legacy-${idOf(row)}`, number: `${row.position}.`, label: row.label, status: true, measurements: [], children: [] })
  }
  return {
    header: { companyName: '', title: '', subtitle: '', showLogos: false },
    details: [],
    statusLegend: statusOptions.map((value) => ({ value, label: value })),
    sections,
    footer: { remarks: false, nextServicing: false },
    signoff: Object.fromEntries(SIGNOFF_STAGES.map((s) => [s, { caption: '', printedName: '' }])),
    damage: { enabled: false, diagramId: null, note: '', extentOptions: [...EXTENT_OPTIONS] },
    source: '',
    legacy: true,
  }
}

export function legacyAnswers(rows) {
  const items = {}
  for (const row of rows) {
    const a = {}
    if (row.status) a.status = row.status
    if (row.remark) a.remark = row.remark
    if (row.action) a.action = row.action
    if (Object.keys(a).length) items[`legacy-${row.id}`] = a
  }
  return { details: {}, items, remarks: '', nextServicing: '', damage: { extent: null, notes: '', markers: [] } }
}
