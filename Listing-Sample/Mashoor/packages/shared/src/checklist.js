// Client-side helpers for checklist form definitions and answers. They mirror
// Backend/mashoor/src/checklist/definition.js so the form can show what is
// missing before the API is asked; the API remains the authority.

export const DETAIL_FIELDS = {
  model: 'Model',
  mileage: 'Mileage (KM)',
  date: 'Date',
  location: 'Location',
  divProject: 'Div. / Project',
}
export const MEASUREMENT_LAYOUTS = {
  axle: [
    ['front_r', 'R'],
    ['front_l', 'L'],
    ['rear_r', 'R'],
    ['rear_l', 'L'],
  ],
  single: [['value', '']],
}
export const POSITION_LABELS = { front_r: 'Front R', front_l: 'Front L', rear_r: 'Rear R', rear_l: 'Rear L', value: '' }
export const EXTENT_OPTIONS = ['None', 'Minor', 'Extensive', 'Beyond Repair']

export function emptyAnswers() {
  return { details: {}, items: {}, remarks: '', nextServicing: '', damage: { extent: null, notes: '', markers: [] } }
}

/** Every item in display order: { item, parent, section }. */
export function allItems(definition) {
  const out = []
  for (const section of definition?.sections ?? []) {
    for (const item of section.items) {
      out.push({ item, parent: null, section })
      for (const child of item.children ?? []) out.push({ item: child, parent: item, section })
    }
  }
  return out
}

export const answerable = (item) => item.status || item.measurements.length > 0

export function itemName(item, parent) {
  return parent ? `${parent.number ? `${parent.number} ` : ''}${parent.label} – ${item.label}` : `${item.number ? `${item.number} ` : ''}${item.label}`
}

export function measurementTitle(m, item) {
  const label = m.label || item.label
  return m.unit ? `${label} (${m.unit})` : label
}

/** Mirrors the API's submit check: [{ field, message }]. */
export function submitProblems(definition, answers) {
  const problems = []
  for (const d of definition.details) {
    if (d.required && !String(answers.details?.[d.key] ?? '').trim()) {
      problems.push({ field: `details.${d.key}`, message: `${DETAIL_FIELDS[d.key]} is required.` })
    }
  }
  for (const { item, parent } of allItems(definition)) {
    const answer = answers.items?.[item.key] ?? {}
    if (item.status && !answer.status) problems.push({ field: `item.${item.key}.status`, message: `${itemName(item, parent)}: choose a status.` })
    for (const m of item.measurements) {
      if (!m.required) continue
      for (const [pos] of MEASUREMENT_LAYOUTS[m.layout]) {
        if (!String(answer.measurements?.[m.key]?.[pos] ?? '').trim()) {
          problems.push({
            field: `item.${item.key}.m.${m.key}.${pos}`,
            message: `${itemName(item, parent)}: enter ${[measurementTitle(m, item), POSITION_LABELS[pos]].filter(Boolean).join(' ')}.`,
          })
        }
      }
    }
  }
  if (definition.damage?.enabled && !answers.damage?.extent) {
    problems.push({ field: 'damage.extent', message: 'Choose the extent of damage (None if there is none).' })
  }
  return problems
}

/** Same rule as the API: any remark text anywhere means acknowledgement is needed. */
export function hasRemarks(answers) {
  if (Object.values(answers.items ?? {}).some((a) => String(a.remark ?? '').trim())) return true
  if (String(answers.remarks ?? '').trim()) return true
  if (String(answers.damage?.notes ?? '').trim()) return true
  return (answers.damage?.markers ?? []).some((m) => String(m.note ?? '').trim())
}

/** Summary rows: exactly the items with a remark or action, as entered. */
export function buildSummary(vehicle, definition, answers) {
  const legend = new Map((definition?.statusLegend ?? []).map((s) => [s.value, s.label]))
  return allItems(definition)
    .map(({ item, parent, section }) => ({ item, parent, section, answer: answers.items?.[item.key] ?? {} }))
    .filter(({ answer }) => String(answer.remark ?? '').trim() || String(answer.action ?? '').trim())
    .map(({ item, parent, section, answer }) => ({
      vehicle,
      itemKey: item.key,
      number: item.number || parent?.number || '',
      label: parent ? `${parent.label} – ${item.label}` : item.label,
      section: [section.number, section.title].filter(Boolean).join(' '),
      status: answer.status ?? null,
      statusLabel: answer.status ? (legend.get(answer.status) ?? answer.status) : null,
      remark: String(answer.remark ?? '').trim(),
      action: String(answer.action ?? '').trim(),
    }))
}

/** Answered / total for the progress badge (status items only). */
export function progress(definition, answers) {
  const statusItems = allItems(definition).filter(({ item }) => item.status)
  return { done: statusItems.filter(({ item }) => answers.items?.[item.key]?.status).length, total: statusItems.length }
}

// Cosmetic tone for a status mark, from its meaning on the legend.
export function statusTone(label = '') {
  if (/satisf|good|ok\b/i.test(label)) return 'ok'
  if (/defect|fail|bad/i.test(label)) return 'bad'
  if (/missing/i.test(label)) return 'warn'
  return 'neutral'
}

export function newKey(prefix = 'k') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

// Immutable update of one item's answer.
export function withItemAnswer(answers, key, patch) {
  const current = answers.items?.[key] ?? {}
  return { ...answers, items: { ...answers.items, [key]: { ...current, ...patch } } }
}

export function withMeasurement(answers, key, mKey, pos, value) {
  const current = answers.items?.[key] ?? {}
  const m = current.measurements ?? {}
  return withItemAnswer(answers, key, { measurements: { ...m, [mKey]: { ...(m[mKey] ?? {}), [pos]: value } } })
}
