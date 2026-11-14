// Start-up import of checklist templates, run after migrations (db.js).
//
//   1. Templates created before migration 0006 (flat item lists) without any
//      version get a published version 1 built from their items. Their 0005
//      rows stay untouched.
//   2. The checklists transcribed from the client's PDF
//      (./mashhorModChecklist.js) and their damage diagrams are imported once,
//      keyed by SEED_KEY. Re-running never duplicates them and never touches
//      a template staff have since edited or published again; if the bundled
//      transcription changes later, the change is reported, not applied.
//
// This module does not import ../db.js (db.js imports it), so it manages its
// own transaction.
import { createHash } from 'node:crypto'
import { legacyDefinition, normalizeDefinition } from './definition.js'
import { MASHHOR_MOD_DIAGRAMS, MASHHOR_MOD_TEMPLATES } from './mashhorModChecklist.js'

export const SCHEMA_VERSION_REQUIRED = 6

const hashOf = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function inTransaction(db, fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function upgradeLegacyTemplates(db, report) {
  const rows = db
    .prepare('SELECT t.* FROM checklist_templates t WHERE NOT EXISTS (SELECT 1 FROM checklist_template_versions v WHERE v.template_id = t.id)')
    .all()
  for (const t of rows) {
    const items = db.prepare('SELECT * FROM checklist_template_items WHERE template_id = ? ORDER BY position, id').all(t.id)
    const definition = normalizeDefinition(legacyDefinition(JSON.parse(t.status_options), items))
    const published = items.length > 0
    db.prepare(
      `INSERT INTO checklist_template_versions (template_id, version, state, definition, created_by, published_by, published_at)
       VALUES (?, 1, ?, ?, ?, ?, ${published ? 'CURRENT_TIMESTAMP' : 'NULL'})`,
    ).run(t.id, published ? 'published' : 'draft', JSON.stringify(definition), t.created_by, published ? t.created_by : null)
    report.upgraded.push(t.name)
  }
}

function importDiagrams(db, diagrams, report) {
  const ids = new Map()
  for (const d of diagrams) {
    let row = db.prepare('SELECT id FROM checklist_diagrams WHERE seed_key = ?').get(d.seedKey)
    if (!row) {
      const id = db
        .prepare('INSERT INTO checklist_diagrams (name, vehicle_type, file, mime_type, source, seed_key) VALUES (?, ?, ?, ?, ?, ?)')
        .run(d.name, d.vehicleType, d.file, 'image/jpeg', d.source, d.seedKey).lastInsertRowid
      row = { id: Number(id) }
      report.diagramsCreated.push(d.name)
    }
    ids.set(d.seedKey, row.id)
  }
  return ids
}

function importTemplates(db, templates, diagramIds, report) {
  for (const t of templates) {
    const hash = hashOf(t)
    const existing = db.prepare('SELECT id FROM checklist_templates WHERE seed_key = ?').get(t.seedKey)
    if (existing) {
      const known = db.prepare('SELECT 1 FROM checklist_template_versions WHERE template_id = ? AND source_hash = ?').get(existing.id, hash)
      if (known) report.unchanged.push(t.name)
      else report.notApplied.push(t.name)
      continue
    }
    const diagramId = diagramIds.get(t.diagramSeedKey) ?? null
    const definition = normalizeDefinition({ ...t.definition, damage: { ...t.definition.damage, diagramId } })
    const legendValues = JSON.stringify(definition.statusLegend.map((s) => s.value))
    const templateId = Number(
      db
        .prepare('INSERT INTO checklist_templates (vehicle_type, name, status_options, active, seed_key) VALUES (?, ?, ?, 1, ?)')
        .run(t.vehicleType, t.name, legendValues, t.seedKey).lastInsertRowid,
    )
    db.prepare(
      `INSERT INTO checklist_template_versions (template_id, version, state, definition, source_hash, published_at)
       VALUES (?, 1, 'published', ?, ?, CURRENT_TIMESTAMP)`,
    ).run(templateId, JSON.stringify(definition), hash)
    db.prepare(
      `INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, metadata)
       VALUES ('system', NULL, 'template.import', 'checklist_template', ?, ?)`,
    ).run(templateId, JSON.stringify({ seedKey: t.seedKey, source: definition.source }))
    report.created.push(t.name)
  }
}

/**
 * Runs both steps in one transaction. Returns a report; does nothing (and
 * says so) on a database older than migration 0006.
 */
export function runChecklistImport(db, { templates = MASHHOR_MOD_TEMPLATES, diagrams = MASHHOR_MOD_DIAGRAMS } = {}) {
  const report = { skipped: false, upgraded: [], diagramsCreated: [], created: [], unchanged: [], notApplied: [] }
  const { user_version: version } = db.prepare('PRAGMA user_version').get()
  if (version < SCHEMA_VERSION_REQUIRED) {
    report.skipped = true
    return report
  }
  inTransaction(db, () => {
    upgradeLegacyTemplates(db, report)
    const diagramIds = importDiagrams(db, diagrams, report)
    importTemplates(db, templates, diagramIds, report)
  })
  return report
}
