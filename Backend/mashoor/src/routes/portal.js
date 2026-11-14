import { Router } from 'express'
import { paginationMeta, parsePagination } from '../../../modules/pagination.module.js'
import { audit, transaction } from '../db.js'
import { requireRole, requireVendor } from '../auth/middleware.js'
import { hashPassword, MAX_PASSWORD_LENGTH, passwordProblem, verifyPassword } from '../auth/passwords.js'
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  deleteUserSessions,
  readCookie,
  setSessionCookie,
  VENDOR_COOKIE,
} from '../auth/sessions.js'
import { countVisibleCatalogs, getVisibleCatalog, listVisibleCatalogs, listVisibleCategories } from '../catalogAccess.js'
import { sendImage } from '../images.js'
import {
  diagramIdsOf,
  EDITABLE,
  formOf,
  getInspection,
  getRevision,
  listRow,
  normalizePersonName,
  portalCanView,
  recordEvent,
  revisionHasRemarks,
  serializeInspection,
  serializeRevision,
  snapshotOf,
  stagesAssignedTo,
  STAGES,
  SUBMITTED,
} from '../inspections.js'
import { AnswerError, itemCount, normalizeAnswers, submitProblems } from '../checklist/definition.js'
import { getDiagram, sendDiagram } from '../checklist/diagrams.js'
import { badRequest, normalizeUsername, notFound, parseId } from '../validate.js'

const INVALID_LOGIN = 'Invalid username or password.'

// role: 'client' (Vendor / Client) or 'inspector' — decides the portal layout.
// signatoryStages: inspection sign-off stages assigned to this account.
const toMe = (db, vendor) => ({
  user: { id: vendor.id, username: vendor.username, name: vendor.name, role: vendor.role },
  company: { id: vendor.companyId, name: vendor.companyName },
  signatoryStages: stagesAssignedTo(db, vendor.companyId, vendor.id),
})

// What a vendor may see of a listing: read-only, no internal fields.
const toListing = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  categoryId: row.category_id,
  categoryName: row.category_name,
  priceCents: row.price_cents,
  currency: row.currency,
  hasImage: Boolean(row.image_file),
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
})

// Every catalog route is read-only and goes through ../catalogAccess.js using
// req.vendor.companyId from the session. Ids from the client are only ever
// used to narrow that visible set, never as proof of access.
export function portalRouter({ db, config, limiter, images, diagrams }) {
  const router = Router()

  router.post('/auth/login', async (req, res) => {
    // Vendors sign in with their username (case-insensitive). Email is not used.
    const username = normalizeUsername(req.body?.username)
    const password = req.body?.password
    if (!username || typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: INVALID_LOGIN })
    }
    const key = `vendor:${req.ip}:${username}`
    if (limiter.isBlocked(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' })

    const user = db
      .prepare(
        `SELECT vu.*, c.name AS company_name, c.status AS company_status
           FROM vendor_users vu JOIN vendor_companies c ON c.id = vu.company_id
          WHERE vu.username = ?`,
      )
      .get(username)
    const valid = await verifyPassword(password, user?.password_hash)
    // Same response for unknown username, wrong password, inactive user, or suspended company.
    if (!user || !valid || user.active !== 1 || user.company_status !== 'active') {
      limiter.recordFailure(key)
      return res.status(401).json({ error: INVALID_LOGIN })
    }
    limiter.reset(key)
    db.prepare('UPDATE vendor_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id)
    setSessionCookie(res, VENDOR_COOKIE, createSession(db, 'vendor', user.id, config.sessionTtlMs), config)
    audit(db, { actorType: 'vendor', actorId: user.id, action: 'vendor.login' })
    res.json(
      toMe(db, {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name,
      }),
    )
  })

  router.post('/auth/logout', (req, res) => {
    deleteSession(db, readCookie(req, VENDOR_COOKIE.name))
    clearSessionCookie(res, VENDOR_COOKIE, config)
    res.status(204).end()
  })

  // ---- Everything below requires an active vendor session ---------------

  router.use(requireVendor(db))

  router.get('/auth/me', (req, res) => res.json(toMe(db, req.vendor)))

  router.post('/auth/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {}
    // Same brute-force guard as sign-in, so a stolen session can't be used to guess the password.
    const key = `vendor-change:${req.vendor.id}`
    if (limiter.isBlocked(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' })
    const row = db.prepare('SELECT password_hash FROM vendor_users WHERE id = ?').get(req.vendor.id)
    const tooLong = typeof currentPassword === 'string' && currentPassword.length > MAX_PASSWORD_LENGTH
    if (tooLong || !(await verifyPassword(currentPassword, row.password_hash))) {
      limiter.recordFailure(key)
      return badRequest(res, 'Current password is incorrect.')
    }
    limiter.reset(key)
    const problem = passwordProblem(newPassword)
    if (problem) return badRequest(res, problem)
    if (newPassword === currentPassword) return badRequest(res, 'Choose a password different from the current one.')
    db.prepare('UPDATE vendor_users SET password_hash = ? WHERE id = ?').run(await hashPassword(newPassword), req.vendor.id)
    // Every existing session of the account ends (other devices are signed out)
    // and this browser gets a brand-new session token, so no token issued under
    // the old password survives the change.
    deleteUserSessions(db, 'vendor', req.vendor.id)
    setSessionCookie(res, VENDOR_COOKIE, createSession(db, 'vendor', req.vendor.id, config.sessionTtlMs), config)
    audit(db, { actorType: 'vendor', actorId: req.vendor.id, action: 'vendor.change_password' })
    res.status(204).end()
  })

  // ---- Vehicle inspections ------------------------------------------------
  // Everything is scoped to req.vendor.companyId (from the session) and to the
  // account's role / assignment; ids from the client never grant access.

  const MAX_TEXT = 2000
  const QUEUES = {
    inspector: {
      assigned: "i.status = 'assigned'",
      draft: "i.status = 'draft'",
      submitted: "i.status IN ('pending_verification', 'pending_approval', 'approved')",
      returned: "i.status = 'returned'",
    },
    client: {
      pending_verification: "i.status = 'pending_verification'",
      returned: "i.status = 'returned'",
      pending_approval: "i.status = 'pending_approval'",
      completed: "i.status = 'approved'",
    },
  }

  const vendorActor = (req) => ({ actorType: 'vendor', actorId: req.vendor.id, actorName: req.vendor.name })
  const auditVendor = (req, action, inspectionId, metadata) =>
    audit(db, { actorType: 'vendor', actorId: req.vendor.id, action, targetType: 'inspection', targetId: inspectionId, metadata })

  // Thrown inside a transaction to roll it back with a 4xx answer.
  class Refusal extends Error {
    constructor(status, message, code, extra) {
      super(message)
      this.status = status
      this.code = code
      this.extra = extra
    }
  }
  function run(res, fn) {
    try {
      transaction(db, fn)
      return true
    } catch (error) {
      if (error instanceof Refusal) {
        res.status(error.status).json({ error: error.message, ...(error.code && { code: error.code }), ...error.extra })
        return false
      }
      if (/UNIQUE constraint failed/i.test(error.message)) {
        res.status(409).json({ error: 'This stage is already confirmed for this revision.' })
        return false
      }
      throw error
    }
  }

  function baseQuery(req) {
    const where = ['i.company_id = ?']
    const params = [req.vendor.companyId]
    if (req.vendor.role === 'inspector') {
      where.push('i.inspector_id = ?')
      params.push(req.vendor.id)
    }
    return { where, params }
  }

  const signedStages = (revisionId) =>
    new Set(db.prepare('SELECT stage FROM inspection_signoffs WHERE revision_id = ?').all(revisionId).map((s) => s.stage))

  // null when the stage may be signed now, otherwise the reason it can't.
  function stageOpen(stage, inspection, rev, signed) {
    if (stage === 'acknowledgement') {
      if (!SUBMITTED.includes(inspection.status)) return 'This inspection is not submitted.'
      if (rev.acknowledgement !== 'pending') return 'Acknowledgement is not pending for this revision.'
      return null
    }
    if (stage === 'checked_by' || stage === 'agreed_by') {
      return ['pending_verification', 'pending_approval'].includes(inspection.status) ? null : 'This stage is not open.'
    }
    // approved_by (Head of Operation)
    if (inspection.status !== 'pending_approval') return 'Head of Operation approval opens after client verification.'
    if (!signed.has('checked_by') || !signed.has('agreed_by')) {
      return 'Checked by and Agreed by must be confirmed on this revision first.'
    }
    const company = db.prepare('SELECT inspection_ack_blocks_approval FROM vendor_companies WHERE id = ?').get(inspection.company_id)
    if (company.inspection_ack_blocks_approval === 1 && rev.acknowledgement === 'pending') {
      return 'The acknowledgement must be completed before approval.'
    }
    return null
  }

  // Inspections waiting on a stage this account is assigned to sign.
  function pendingSignoffs(req) {
    const stages = stagesAssignedTo(db, req.vendor.companyId, req.vendor.id)
    if (!stages.length) return []
    const rows = db
      .prepare(
        `SELECT i.*, c.name AS company_name FROM inspections i JOIN vendor_companies c ON c.id = i.company_id
          WHERE i.company_id = ? AND i.status IN ('pending_verification', 'pending_approval', 'approved')
          ORDER BY i.updated_at DESC`,
      )
      .all(req.vendor.companyId)
    return rows.filter((row) => {
      const rev = getRevision(db, row.id, row.current_revision)
      if (!rev) return false
      const signed = signedStages(rev.id)
      return stages.some((stage) => !signed.has(stage) && stageOpen(stage, row, rev, signed) === null)
    })
  }

  function loadForPortal(req, res) {
    const id = parseId(req.params.id)
    const inspection = id && getInspection(db, id)
    if (!inspection || !portalCanView(db, inspection, req.vendor)) {
      notFound(res)
      return null
    }
    return inspection
  }

  // The client must name the revision it reviewed; anything else is stale.
  function requireCurrentRevision(req, inspection) {
    const revision = Number(req.body?.revision)
    if (!Number.isInteger(revision) || revision < 1 || revision !== inspection.current_revision) {
      throw new Refusal(409, 'This inspection has changed since you opened it. Reload to review the current revision.', 'STALE_REVISION')
    }
    return getRevision(db, inspection.id, revision)
  }

  // Validates the inspector's answers against the inspection's own form
  // definition and stores them as the working copy. A 0005 inspection gets
  // its (converted) definition stored alongside on first save; its old item
  // rows are left as they were.
  function saveAnswers(inspection, input) {
    const { definition, answers: current } = formOf(db, inspection)
    let answers = current
    if (input !== undefined) {
      try {
        answers = normalizeAnswers(definition, input)
      } catch (error) {
        if (error instanceof AnswerError) throw new Refusal(400, error.message)
        throw error
      }
    }
    db.prepare('UPDATE inspections SET form_definition = ?, form_answers = ? WHERE id = ?').run(
      inspection.form_definition ?? JSON.stringify(definition),
      JSON.stringify(answers),
      inspection.id,
    )
    return { definition, answers }
  }

  function requireAssignedInspector(req, inspection) {
    if (req.vendor.role !== 'inspector' || inspection.inspector_id !== req.vendor.id) {
      throw new Refusal(403, 'Only the assigned inspector can change this checklist.')
    }
    if (!EDITABLE.includes(inspection.status)) throw new Refusal(409, 'This checklist is not open for editing.')
  }

  function requireClientDecision(req, inspection) {
    if (req.vendor.role !== 'client') throw new Refusal(403, 'Only client accounts can verify inspections.')
    if (inspection.status !== 'pending_verification') {
      throw new Refusal(409, 'This inspection is not waiting for client verification.')
    }
  }

  router.get('/inspections/counts', (req, res) => {
    const counts = {}
    for (const [queue, condition] of Object.entries(QUEUES[req.vendor.role] ?? {})) {
      const { where, params } = baseQuery(req)
      counts[queue] = db.prepare(`SELECT COUNT(*) AS n FROM inspections i WHERE ${where.join(' AND ')} AND ${condition}`).get(...params).n
    }
    counts.signoffs = pendingSignoffs(req).length
    res.json({ counts, signatoryStages: stagesAssignedTo(db, req.vendor.companyId, req.vendor.id) })
  })

  router.get('/inspections', (req, res) => {
    const queue = String(req.query.queue ?? '')
    if (queue === 'signoffs') return res.json({ inspections: pendingSignoffs(req).map((row) => listRow(db, row)) })
    const condition = QUEUES[req.vendor.role]?.[queue]
    if (!condition) return badRequest(res, 'Unknown inspection list.')
    const { where, params } = baseQuery(req)
    const rows = db
      .prepare(
        `SELECT i.*, c.name AS company_name FROM inspections i JOIN vendor_companies c ON c.id = i.company_id
          WHERE ${where.join(' AND ')} AND ${condition} ORDER BY i.updated_at DESC, i.id DESC`,
      )
      .all(...params)
    res.json({ inspections: rows.map((row) => listRow(db, row)) })
  })

  router.get('/inspections/:id', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const isAssignedInspector = req.vendor.role === 'inspector' && inspection.inspector_id === req.vendor.id
    const rev = getRevision(db, inspection.id, inspection.current_revision)
    const myStages = stagesAssignedTo(db, inspection.company_id, req.vendor.id)
    const signed = rev ? signedStages(rev.id) : new Set()
    res.json({
      inspection: serializeInspection(db, inspection, { includeWorking: isAssignedInspector }),
      viewer: {
        accountId: req.vendor.id,
        isAssignedInspector,
        canEdit: isAssignedInspector && EDITABLE.includes(inspection.status),
        canVerify: req.vendor.role === 'client' && inspection.status === 'pending_verification',
        // For each stage assigned to this account: can it be confirmed now, and if not, why not.
        stages: myStages.map((stage) => ({
          stage,
          signed: signed.has(stage),
          blockedReason: !rev ? 'Not submitted yet.' : signed.has(stage) ? null : stageOpen(stage, inspection, rev, signed),
        })),
      },
    })
  })

  // An earlier (or the current) submitted revision with its frozen form.
  router.get('/inspections/:id/revisions/:revision', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const number = parseId(req.params.revision)
    const revision = number && serializeRevision(db, inspection, number)
    if (!revision) return notFound(res)
    res.json({ revision })
  })

  // Damage diagram image — only one this inspection (or one of its revisions) uses.
  router.get('/inspections/:id/diagrams/:diagramId', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const diagramId = parseId(req.params.diagramId)
    if (!diagramId || !diagramIdsOf(db, inspection).has(diagramId)) return notFound(res)
    const row = getDiagram(db, diagramId)
    if (!row) return notFound(res)
    res.set('Cache-Control', 'private, max-age=3600')
    sendDiagram(res, diagrams, row)
  })

  // Draft save: the whole answers object (vehicle details, items, remarks,
  // next servicing, damage). Nothing is required yet.
  router.put('/inspections/:id/form', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const ok = run(res, () => {
      requireAssignedInspector(req, inspection)
      if (req.body?.answers === undefined) throw new Refusal(400, 'answers are required.')
      saveAnswers(inspection, req.body.answers)
      const next = inspection.status === 'assigned' ? 'draft' : inspection.status
      db.prepare('UPDATE inspections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, inspection.id)
      if (inspection.status === 'assigned') recordEvent(db, { inspectionId: inspection.id, ...vendorActor(req), action: 'started' })
    })
    if (ok) res.json({ inspection: serializeInspection(db, getInspection(db, inspection.id), { includeWorking: true }) })
  })

  router.post('/inspections/:id/submit', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const ok = run(res, () => {
      requireAssignedInspector(req, inspection)
      const { definition, answers } = saveAnswers(inspection, req.body?.answers)
      if (itemCount(definition) === 0) throw new Refusal(400, 'This checklist has no items.')
      const problems = submitProblems(definition, answers)
      if (problems.length) {
        throw new Refusal(400, `Complete the checklist before submitting (${problems.length} missing).`, 'INCOMPLETE', { problems })
      }
      const fresh = getInspection(db, inspection.id)
      const revision = fresh.current_revision + 1
      const hasRemarks = revisionHasRemarks(answers)
      db.prepare(
        `INSERT INTO inspection_revisions (inspection_id, revision, snapshot, has_remarks, acknowledgement, submitted_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        inspection.id,
        revision,
        JSON.stringify(snapshotOf(fresh, definition, answers)),
        hasRemarks ? 1 : 0,
        hasRemarks ? 'pending' : 'auto',
        req.vendor.id,
      )
      db.prepare(
        `UPDATE inspections SET status = 'pending_verification', current_revision = ?, recheck_reason = NULL,
                updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).run(revision, inspection.id)
      const action = revision === 1 ? 'submitted' : 'resubmitted'
      recordEvent(db, { inspectionId: inspection.id, revision, ...vendorActor(req), action })
      auditVendor(req, `inspection.${action}`, inspection.id, { revision })
      if (!hasRemarks) {
        // A system action — not attributed to the acknowledger.
        recordEvent(db, { inspectionId: inspection.id, revision, actorType: 'system', action: 'acknowledgement.auto', detail: 'Auto-acknowledged — no remarks.' })
        audit(db, { actorType: 'system', action: 'inspection.acknowledgement_auto', targetType: 'inspection', targetId: inspection.id, metadata: { revision } })
      }
    })
    if (ok) res.json({ inspection: serializeInspection(db, getInspection(db, inspection.id), { includeWorking: true }) })
  })

  router.post('/inspections/:id/recheck', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const ok = run(res, () => {
      requireClientDecision(req, inspection)
      requireCurrentRevision(req, inspection)
      if (reason.length < 5) throw new Refusal(400, 'Explain what is missing or incorrect so the inspector can re-check it.')
      if (reason.length > MAX_TEXT) throw new Refusal(400, `The explanation is too long (max ${MAX_TEXT} characters).`)
      db.prepare(`UPDATE inspections SET status = 'returned', recheck_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        reason,
        inspection.id,
      )
      recordEvent(db, { inspectionId: inspection.id, revision: inspection.current_revision, ...vendorActor(req), action: 'recheck_requested', detail: reason })
      auditVendor(req, 'inspection.recheck_requested', inspection.id, { revision: inspection.current_revision })
    })
    if (ok) res.json({ inspection: serializeInspection(db, getInspection(db, inspection.id)) })
  })

  router.post('/inspections/:id/verify', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const ok = run(res, () => {
      requireClientDecision(req, inspection)
      const rev = requireCurrentRevision(req, inspection)
      db.prepare(`UPDATE inspections SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(inspection.id)
      db.prepare('UPDATE inspection_revisions SET verified_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.vendor.id, rev.id)
      recordEvent(db, { inspectionId: inspection.id, revision: rev.revision, ...vendorActor(req), action: 'submitted_for_approval' })
      auditVendor(req, 'inspection.verified', inspection.id, { revision: rev.revision })
    })
    if (ok) res.json({ inspection: serializeInspection(db, getInspection(db, inspection.id)) })
  })

  // Name-confirmed sign-off by the signed-in account for its own assigned stage.
  router.post('/inspections/:id/signoffs/:stage', (req, res) => {
    const inspection = loadForPortal(req, res)
    if (!inspection) return
    const stage = req.params.stage
    if (!STAGES.includes(stage)) return notFound(res)
    const ok = run(res, () => {
      if (!stagesAssignedTo(db, inspection.company_id, req.vendor.id).includes(stage)) {
        throw new Refusal(403, 'This stage is not assigned to your account.')
      }
      const rev = requireCurrentRevision(req, inspection)
      const signed = signedStages(rev.id)
      if (signed.has(stage)) throw new Refusal(409, 'This stage is already confirmed for this revision.')
      const blocked = stageOpen(stage, inspection, rev, signed)
      if (blocked) throw new Refusal(409, blocked)
      const typed = normalizePersonName(req.body?.fullName)
      if (!typed || typed !== normalizePersonName(req.vendor.name)) {
        throw new Refusal(400, 'The name you entered does not match the full name on your account.')
      }
      db.prepare('INSERT INTO inspection_signoffs (revision_id, stage, user_id, name_snapshot) VALUES (?, ?, ?, ?)').run(
        rev.id,
        stage,
        req.vendor.id,
        req.vendor.name,
      )
      if (stage === 'acknowledgement') db.prepare("UPDATE inspection_revisions SET acknowledgement = 'acknowledged' WHERE id = ?").run(rev.id)
      if (stage === 'approved_by') {
        db.prepare("UPDATE inspections SET status = 'approved', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
          inspection.id,
        )
      } else {
        db.prepare('UPDATE inspections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(inspection.id)
      }
      recordEvent(db, { inspectionId: inspection.id, revision: rev.revision, ...vendorActor(req), action: `signed.${stage}` })
      auditVendor(req, `inspection.signed.${stage}`, inspection.id, { revision: rev.revision })
    })
    if (ok) res.json({ inspection: serializeInspection(db, getInspection(db, inspection.id)) })
  })

  // ---- Catalog (read-only) — Vendor / Client accounts only ----------------

  router.use(['/categories', '/listings'], requireRole('client'))

  router.get('/categories', (req, res) => {
    const rows = listVisibleCategories(db, req.vendor.companyId)
    res.json({
      categories: rows.map((r) => ({ id: r.id, name: r.name, description: r.description, listingCount: r.listing_count })),
    })
  })

  router.get('/listings', (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : ''
    let categoryId = null
    if (req.query.categoryId !== undefined && req.query.categoryId !== '') {
      categoryId = parseId(req.query.categoryId)
      if (!categoryId) return badRequest(res, 'Invalid category filter.')
    }
    const { page, limit, offset } = parsePagination(req)
    const companyId = req.vendor.companyId
    const total = countVisibleCatalogs(db, companyId, { search, categoryId })
    const rows = listVisibleCatalogs(db, companyId, { search, categoryId, limit, offset })
    res.json({ listings: rows.map(toListing), pagination: paginationMeta({ page, limit, total }) })
  })

  router.get('/listings/:id', (req, res) => {
    const id = parseId(req.params.id)
    const row = id && getVisibleCatalog(db, req.vendor.companyId, id)
    if (!row) return notFound(res)
    res.json({ listing: toListing(row) })
  })

  router.get('/listings/:id/image', (req, res) => {
    const id = parseId(req.params.id)
    const row = id && getVisibleCatalog(db, req.vendor.companyId, id)
    if (!row?.image_file) return notFound(res)
    sendImage(res, images, row.image_file, row.image_type)
  })

  return router
}
