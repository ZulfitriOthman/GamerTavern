// Vehicle inspection checklists: shared rules for the admin and portal routes.
//
// Workflow (backend-enforced; see routes/portal.js):
//   assigned → draft (inspector saves) → pending_verification (inspector submits,
//   creating revision N) → returned (client requests re-check with a reason)
//   → pending_verification (inspector resubmits = revision N+1)
//   → pending_approval (client sends revision N to Head of Operation)
//   → approved (assigned HOO confirms on that revision).
// Sign-offs, verification and acknowledgement always reference one exact
// revision; a new revision starts every stage again.
//
// Each inspection carries its own copy of the template version's form
// definition (checklist/definition.js) plus the inspector's working answers.
// Inspections created before migration 0006 (flat item list) are read through
// legacyDefinition/legacyAnswers and move to the same columns on first save.
import { buildSummary, hasRemarks, legacyAnswers, legacyDefinition } from './checklist/definition.js'

export const VEHICLE_TYPES = ['FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS']
export const STAGES = ['checked_by', 'agreed_by', 'approved_by', 'acknowledgement']
export const STAGE_LABELS = {
  checked_by: 'Checked by',
  agreed_by: 'Agreed by',
  approved_by: 'Approved by (Head of Operation)',
  acknowledgement: 'Acknowledgement',
}
export const STATUSES = ['assigned', 'draft', 'pending_verification', 'returned', 'pending_approval', 'approved']
export const EDITABLE = ['assigned', 'draft', 'returned'] // inspector may change the working copy
export const SUBMITTED = ['pending_verification', 'pending_approval', 'approved']

// Name confirmation compares like for like: Unicode NFKC, trimmed, inner
// whitespace collapsed, case-insensitive. It confirms intent only — the
// account itself is identified by the authenticated session.
export function normalizePersonName(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US')
}

// With { forUpdate: true } inside a transaction the row stays locked until
// commit, so two concurrent workflow steps on one inspection run one after
// the other (SQLite serialised all writes; InnoDB locks rows).
export function getInspection(db, id, { forUpdate = false } = {}) {
  return db.prepare(`SELECT * FROM mashoor_inspections WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`).get(id)
}

export function inspectionItems(db, inspectionId) {
  return db.prepare('SELECT * FROM mashoor_inspection_items WHERE inspection_id = ? ORDER BY position, id').all(inspectionId)
}

export async function getRevision(db, inspectionId, revision) {
  return revision > 0
    ? db.prepare('SELECT * FROM mashoor_inspection_revisions WHERE inspection_id = ? AND revision = ?').get(inspectionId, revision)
    : undefined
}

export async function signatoriesFor(db, companyId) {
  const rows = await db
    .prepare(
      `SELECT s.stage, s.user_id, u.name, u.username, u.active
         FROM mashoor_inspection_signatories s JOIN mashoor_vendor_users u ON u.id = s.user_id
        WHERE s.company_id = ?`,
    )
    .all(companyId)
  const byStage = Object.fromEntries(rows.map((r) => [r.stage, r]))
  return STAGES.map((stage) => {
    const r = byStage[stage]
    return {
      stage,
      label: STAGE_LABELS[stage],
      assignee: r ? { id: r.user_id, name: r.name, username: r.username, active: r.active === 1 } : null,
    }
  })
}

export async function stagesAssignedTo(db, companyId, userId) {
  const rows = await db.prepare('SELECT stage FROM mashoor_inspection_signatories WHERE company_id = ? AND user_id = ?').all(companyId, userId)
  return rows.map((r) => r.stage)
}

export function vehicleOf(inspection) {
  return {
    type: inspection.vehicle_type,
    plate: inspection.vehicle_plate,
    registrationNo: inspection.vehicle_registration_no,
    modRegistrationNo: inspection.mod_registration_no,
  }
}

/** The inspection's form definition and working answers (0005 inspections converted on read). */
export async function formOf(db, inspection) {
  if (inspection.form_definition) {
    return {
      definition: JSON.parse(inspection.form_definition),
      answers: inspection.form_answers ? JSON.parse(inspection.form_answers) : legacyAnswers([]),
    }
  }
  const rows = await inspectionItems(db, inspection.id)
  return { definition: legacyDefinition(JSON.parse(inspection.status_options), rows), answers: legacyAnswers(rows) }
}

/** What a submitted revision freezes: the exact form and every answer. */
export function snapshotOf(inspection, definition, answers) {
  return {
    format: 2,
    vehicle: vehicleOf(inspection),
    templateName: inspection.template_name,
    templateVersion: inspection.template_version ?? null,
    definition,
    answers,
  }
}

/** Reads a revision snapshot of either format into { vehicle, templateName, templateVersion, definition, answers }. */
export function readSnapshot(raw) {
  const snapshot = JSON.parse(raw)
  if (snapshot.format === 2) return snapshot
  // 0005 snapshot: { vehicle, templateName, statusOptions, items: [{ id, position, section, label, status, remark, action }] }
  return {
    format: 1,
    vehicle: snapshot.vehicle,
    templateName: snapshot.templateName,
    templateVersion: null,
    definition: legacyDefinition(snapshot.statusOptions, snapshot.items),
    answers: legacyAnswers(snapshot.items),
  }
}

export function revisionHasRemarks(answers) {
  return hasRemarks(answers)
}

export async function recordEvent(db, { inspectionId, revision = null, actorType, actorId = null, actorName = null, action, detail = null }) {
  await db
    .prepare(
      `INSERT INTO mashoor_inspection_events (inspection_id, revision, actor_type, actor_id, actor_name, action, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(inspectionId, revision, actorType, actorId, actorName, action, detail)
}

// Who may open an inspection in the portal (beyond being in the same company):
// its assigned inspector, any client of the company, or a signatory of the company.
export async function portalCanView(db, inspection, vendor) {
  if (!inspection || inspection.company_id !== vendor.companyId) return false
  if (vendor.role === 'client') return true
  if (inspection.inspector_id === vendor.id) return true
  return (await stagesAssignedTo(db, vendor.companyId, vendor.id)).length > 0
}

/** Diagram ids an inspection refers to (its own form and every submitted revision). */
export async function diagramIdsOf(db, inspection) {
  const ids = new Set()
  const add = (definition) => definition?.damage?.enabled && definition.damage.diagramId && ids.add(definition.damage.diagramId)
  if (inspection.form_definition) add(JSON.parse(inspection.form_definition))
  for (const r of await db.prepare('SELECT snapshot FROM mashoor_inspection_revisions WHERE inspection_id = ?').all(inspection.id)) add(readSnapshot(r.snapshot).definition)
  return ids
}

async function revisionView(db, revisionRow, { current, withForm }) {
  const signoffs = (await db.prepare('SELECT * FROM mashoor_inspection_signoffs WHERE revision_id = ? ORDER BY signed_at, id').all(revisionRow.id)).map((s) => ({
    stage: s.stage,
    userId: s.user_id,
    name: s.name_snapshot,
    signedAt: s.signed_at,
  }))
  const verifier = revisionRow.verified_by ? await db.prepare('SELECT name FROM mashoor_vendor_users WHERE id = ?').get(revisionRow.verified_by) : null
  const submitter = await db.prepare('SELECT name FROM mashoor_vendor_users WHERE id = ?').get(revisionRow.submitted_by)
  const view = {
    revision: revisionRow.revision,
    current,
    submittedAt: revisionRow.submitted_at,
    submittedBy: submitter ? { id: revisionRow.submitted_by, name: submitter.name } : null,
    hasRemarks: revisionRow.has_remarks === 1,
    acknowledgement: revisionRow.acknowledgement,
    verifiedBy: verifier ? { id: revisionRow.verified_by, name: verifier.name, at: revisionRow.verified_at } : null,
    signoffs,
  }
  if (withForm) {
    const snapshot = readSnapshot(revisionRow.snapshot)
    view.snapshot = snapshot
    view.summary = buildSummary(snapshot.vehicle, snapshot.definition, snapshot.answers)
  }
  return view
}

/** One revision with its frozen form (for history / print of an earlier revision). */
export async function serializeRevision(db, inspection, revisionNumber) {
  const row = await getRevision(db, inspection.id, revisionNumber)
  return row ? revisionView(db, row, { current: row.revision === inspection.current_revision, withForm: true }) : null
}

// Full inspection for display. The working copy (definition + answers being
// edited) is included only when `includeWorking` (the assigned inspector, or staff).
export async function serializeInspection(db, inspection, { includeWorking = false } = {}) {
  const company = await db.prepare('SELECT id, name, inspection_ack_blocks_approval FROM mashoor_vendor_companies WHERE id = ?').get(inspection.company_id)
  const inspector = await db.prepare('SELECT id, name, username, active, role FROM mashoor_vendor_users WHERE id = ?').get(inspection.inspector_id)
  const revisions = []
  for (const r of await db.prepare('SELECT * FROM mashoor_inspection_revisions WHERE inspection_id = ? ORDER BY revision DESC').all(inspection.id)) {
    const current = r.revision === inspection.current_revision
    revisions.push(await revisionView(db, r, { current, withForm: current }))
  }
  const events = (await db.prepare('SELECT * FROM mashoor_inspection_events WHERE inspection_id = ? ORDER BY id').all(inspection.id)).map((e) => ({ revision: e.revision, actorType: e.actor_type, actorName: e.actor_name, action: e.action, detail: e.detail, at: e.created_at }))
  const result = {
    id: inspection.id,
    company: { id: company.id, name: company.name },
    ackBlocksApproval: company.inspection_ack_blocks_approval === 1,
    inspector: { id: inspector.id, name: inspector.name, username: inspector.username, active: inspector.active === 1 },
    templateName: inspection.template_name,
    templateVersion: inspection.template_version ?? null,
    vehicle: vehicleOf(inspection),
    status: inspection.status,
    currentRevision: inspection.current_revision,
    recheckReason: inspection.recheck_reason,
    createdAt: inspection.created_at,
    updatedAt: inspection.updated_at,
    approvedAt: inspection.approved_at,
    signatories: await signatoriesFor(db, inspection.company_id),
    revisions,
    events,
  }
  if (includeWorking) {
    const { definition, answers } = await formOf(db, inspection)
    result.working = { definition, answers, summary: buildSummary(vehicleOf(inspection), definition, answers) }
  }
  return result
}

export async function listRow(db, row) {
  const inspector = await db.prepare('SELECT name, username FROM mashoor_vendor_users WHERE id = ?').get(row.inspector_id)
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    inspector: inspector ? { id: row.inspector_id, name: inspector.name, username: inspector.username } : null,
    vehicle: vehicleOf(row),
    templateName: row.template_name,
    templateVersion: row.template_version ?? null,
    status: row.status,
    currentRevision: row.current_revision,
    recheckReason: row.recheck_reason,
    updatedAt: row.updated_at,
  }
}
