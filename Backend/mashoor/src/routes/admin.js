import { Router } from 'express'
import { paginationMeta, parsePagination } from '../../../modules/pagination.module.js'
import { audit, transaction } from '../db.js'
import { requireStaff } from '../auth/middleware.js'
import { hashPassword, MAX_PASSWORD_LENGTH, passwordProblem, verifyPassword } from '../auth/passwords.js'
import {
  clearSessionCookie,
  createSession,
  deleteCompanySessions,
  deleteSession,
  deleteUserSessions,
  readCookie,
  setSessionCookie,
  STAFF_COOKIE,
} from '../auth/sessions.js'
import { receiveImage, sendImage } from '../images.js'
import {
  DefinitionError,
  DETAIL_FIELDS,
  initialAnswers,
  itemCount,
  normalizeDefinition,
  publishProblems,
} from '../checklist/definition.js'
import { getDiagram, sendDiagram, toDiagram } from '../checklist/diagrams.js'
import {
  EDITABLE,
  getInspection,
  listRow,
  recordEvent,
  serializeInspection,
  serializeRevision,
  signatoriesFor,
  STAGE_LABELS,
  STAGES,
  STATUSES as INSPECTION_STATUSES,
  VEHICLE_TYPES,
} from '../inspections.js'
import {
  badRequest,
  cleanText,
  normalizeCategoryName,
  normalizeEmail,
  normalizeUsername,
  notFound,
  parseId,
  parseIdValue,
  parsePrice,
  USERNAME_RULE,
} from '../validate.js'

const INVALID_LOGIN = 'Invalid email or password.'
const USERNAME_TAKEN = 'That username is already taken.'
const ROLES = ['client', 'inspector']
const ROLE_RULE = 'Role must be Vendor / Client or Inspector.'
const LISTING_STATUSES = ['draft', 'published', 'archived']

const toStaff = (row) => ({ id: row.id, email: row.email, name: row.name, role: row.role })

const toCompany = (row) => ({
  id: row.id,
  name: row.name,
  registrationNo: row.registration_no,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.user_count !== undefined && {
    userCount: row.user_count,
    activeUserCount: row.active_user_count ?? 0,
  }),
  ...(row.category_count !== undefined && { categoryCount: row.category_count }),
})

// Never includes password_hash. username is null only for accounts created before
// migration 0003, until staff set one (such an account cannot sign in until then).
const toVendorUser = (row) => ({
  id: row.id,
  companyId: row.company_id,
  username: row.username,
  name: row.name,
  role: row.role,
  active: row.active === 1,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
})

const toCategory = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  active: row.active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.listing_count !== undefined && {
    listingCount: row.listing_count,
    publishedCount: row.published_count ?? 0,
    vendorCount: row.vendor_count,
  }),
})

const toListing = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  categoryId: row.category_id,
  categoryName: row.category_name ?? null,
  categoryActive: row.category_active === 1,
  priceCents: row.price_cents,
  currency: row.currency,
  hasImage: Boolean(row.image_file),
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const isUniqueViolation = (error) => /UNIQUE constraint failed/i.test(error?.message ?? '')

export function adminRouter({ db, config, limiter, images, diagrams }) {
  const router = Router()
  const actor = (req) => ({ actorType: 'staff', actorId: req.staff.id })

  const getCompany = (id) => db.prepare('SELECT * FROM vendor_companies WHERE id = ?').get(id)
  const getVendorUser = (id) => db.prepare('SELECT * FROM vendor_users WHERE id = ?').get(id)
  const usernameTaken = (username, exceptId = 0) =>
    db.prepare('SELECT 1 FROM vendor_users WHERE username = ? AND id <> ?').get(username, exceptId)
  const getCategory = (id) => db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  const categoryKeyTaken = (key, exceptId = 0) =>
    db.prepare('SELECT name FROM categories WHERE name_key = ? AND id <> ?').get(key, exceptId)
  const companyCategories = (companyId) =>
    db
      .prepare(
        `SELECT cg.* FROM vendor_company_categories vcc JOIN categories cg ON cg.id = vcc.category_id
          WHERE vcc.company_id = ? ORDER BY cg.name COLLATE NOCASE`,
      )
      .all(companyId)
  const LISTING_SELECT = `SELECT cat.*, cg.name AS category_name, cg.active AS category_active
                            FROM catalogs cat LEFT JOIN categories cg ON cg.id = cat.category_id`
  const getListing = (id) => db.prepare(`${LISTING_SELECT} WHERE cat.id = ?`).get(id)

  // ---- Auth (public) ----------------------------------------------------

  router.post('/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password
    if (!email || typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: INVALID_LOGIN })
    }
    const key = `staff:${req.ip}:${email}`
    if (limiter.isBlocked(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' })

    const staff = db.prepare('SELECT * FROM staff_users WHERE email = ?').get(email)
    const valid = await verifyPassword(password, staff?.password_hash)
    if (!staff || !valid || staff.active !== 1) {
      limiter.recordFailure(key)
      return res.status(401).json({ error: INVALID_LOGIN })
    }
    limiter.reset(key)
    setSessionCookie(res, STAFF_COOKIE, createSession(db, 'staff', staff.id, config.sessionTtlMs), config)
    audit(db, { actorType: 'staff', actorId: staff.id, action: 'staff.login' })
    res.json({ user: toStaff(staff) })
  })

  router.post('/auth/logout', (req, res) => {
    deleteSession(db, readCookie(req, STAFF_COOKIE.name))
    clearSessionCookie(res, STAFF_COOKIE, config)
    res.status(204).end()
  })

  // ---- Everything below requires an active staff session ----------------

  router.use(requireStaff(db))

  router.get('/auth/me', (req, res) => res.json({ user: toStaff(req.staff) }))

  // ---- Dashboard ----------------------------------------------------------

  router.get('/dashboard', (req, res) => {
    const one = (sql) => db.prepare(sql).get()
    const vendors = one(`SELECT COUNT(*) AS total, COALESCE(SUM(status = 'active'), 0) AS active FROM vendor_companies`)
    // An account can sign in only if it is active AND its company is active.
    const accounts = one(
      `SELECT COUNT(*) AS total, COALESCE(SUM(vu.active = 1 AND c.status = 'active'), 0) AS active
         FROM vendor_users vu JOIN vendor_companies c ON c.id = vu.company_id`,
    )
    const categories = one('SELECT COUNT(*) AS total, COALESCE(SUM(active = 1), 0) AS active FROM categories')
    const listings = one(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status = 'draft'), 0) AS draft,
              COALESCE(SUM(status = 'published'), 0) AS published,
              COALESCE(SUM(status = 'archived'), 0) AS archived
         FROM catalogs`,
    )
    res.json({
      totals: {
        vendors: { total: vendors.total, active: vendors.active },
        vendorAccounts: { total: accounts.total, active: accounts.active },
        categories: { total: categories.total, active: categories.active },
        listings,
      },
    })
  })

  // ---- Vendor companies -------------------------------------------------

  router.get('/vendors', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM vendor_users u WHERE u.company_id = c.id) AS user_count,
                (SELECT COUNT(*) FROM vendor_users u WHERE u.company_id = c.id AND u.active = 1) AS active_user_count,
                (SELECT COUNT(*) FROM vendor_company_categories v WHERE v.company_id = c.id) AS category_count
           FROM vendor_companies c
          ORDER BY c.name COLLATE NOCASE`,
      )
      .all()
    // Login accounts per company (never any password data), for list actions.
    const accounts = {}
    for (const row of db.prepare('SELECT * FROM vendor_users ORDER BY company_id, id').all()) {
      ;(accounts[row.company_id] ??= []).push(toVendorUser(row))
    }
    res.json({ vendors: rows.map((row) => ({ ...toCompany(row), accounts: accounts[row.id] ?? [] })) })
  })

  // Reads { username, password, confirmPassword? } chosen by staff.
  function readCredentials(body, { exceptId = 0 } = {}) {
    const username = normalizeUsername(body?.username)
    if (!username) return { error: USERNAME_RULE, status: 400 }
    if (usernameTaken(username, exceptId)) return { error: USERNAME_TAKEN, status: 409 }
    const password = readNewPassword(body)
    if (password.error) return password
    return { username, password: password.value }
  }

  function readNewPassword(body) {
    const password = body?.password
    const problem = passwordProblem(password)
    if (problem) return { error: problem, status: 400 }
    if (body?.confirmPassword !== undefined && body.confirmPassword !== password) {
      return { error: 'Passwords do not match.', status: 400 }
    }
    return { value: password }
  }

  // Creates the company and, optionally, its first login account in one step.
  // No email is involved and there is no public registration.
  router.post('/vendors', async (req, res) => {
    const body = req.body ?? {}
    const name = cleanText(body.name, 200)
    if (!name) return badRequest(res, 'Company name is required.')
    const registrationNo = cleanText(body.registrationNo, 100) || null
    const status = body.status ?? 'active'
    if (!['active', 'suspended'].includes(status)) return badRequest(res, 'Invalid status.')

    let account = null
    if (body.account != null) {
      const accountName = cleanText(body.account.name, 200)
      if (!accountName) return badRequest(res, 'Contact name is required.')
      const credentials = readCredentials(body.account)
      if (credentials.error) return res.status(credentials.status).json({ error: credentials.error })
      const role = body.account.role ?? 'client'
      if (!ROLES.includes(role)) return badRequest(res, ROLE_RULE)
      account = { name: accountName, username: credentials.username, role, hash: await hashPassword(credentials.password) }
    }

    let ids
    try {
      ids = transaction(db, () => {
        const companyId = Number(
          db
            .prepare('INSERT INTO vendor_companies (name, registration_no, status) VALUES (?, ?, ?)')
            .run(name, registrationNo, status).lastInsertRowid,
        )
        audit(db, { ...actor(req), action: 'vendor.create', targetType: 'vendor_company', targetId: companyId, metadata: { name, status } })
        let userId = null
        if (account) {
          userId = insertVendorUser(companyId, account)
          audit(db, {
            ...actor(req),
            action: 'vendor_user.create',
            targetType: 'vendor_user',
            targetId: userId,
            metadata: { companyId, username: account.username, role: account.role },
          })
        }
        return { companyId, userId }
      })
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: USERNAME_TAKEN })
      throw error
    }
    res.status(201).json({
      vendor: toCompany(getCompany(ids.companyId)),
      ...(account && { user: toVendorUser(getVendorUser(ids.userId)) }),
    })
  })

  router.get('/vendors/:id', (req, res) => {
    const id = parseId(req.params.id)
    const company = id && getCompany(id)
    if (!company) return notFound(res)
    const users = db
      .prepare('SELECT * FROM vendor_users WHERE company_id = ? ORDER BY name COLLATE NOCASE')
      .all(id)
    res.json({ vendor: toCompany(company), users: users.map(toVendorUser), categories: companyCategories(id).map(toCategory) })
  })

  router.patch('/vendors/:id', (req, res) => {
    const id = parseId(req.params.id)
    const company = id && getCompany(id)
    if (!company) return notFound(res)

    const body = req.body ?? {}
    const updates = {}
    if ('name' in body) {
      updates.name = cleanText(body.name, 200)
      if (!updates.name) return badRequest(res, 'Company name is required.')
    }
    if ('registrationNo' in body) updates.registration_no = cleanText(body.registrationNo, 100) || null
    if ('status' in body) {
      if (!['active', 'suspended'].includes(body.status)) return badRequest(res, 'Invalid status.')
      updates.status = body.status
    }
    const columns = Object.keys(updates)
    if (columns.length === 0) return badRequest(res, 'Nothing to update.')

    transaction(db, () => {
      db.prepare(
        `UPDATE vendor_companies SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).run(...columns.map((c) => updates[c]), id)
      if (updates.status === 'suspended') deleteCompanySessions(db, id)
      audit(db, { ...actor(req), action: 'vendor.update', targetType: 'vendor_company', targetId: id, metadata: updates })
    })
    res.json({ vendor: toCompany(getCompany(id)) })
  })

  // Replaces the company's full category set. Takes effect on the vendor's
  // next request (access is evaluated per request, nothing is cached).
  router.put('/vendors/:id/categories', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getCompany(id)) return notFound(res)
    const raw = req.body?.categoryIds
    if (!Array.isArray(raw) || raw.length > 500) return badRequest(res, 'categoryIds must be a list of category ids.')
    const wanted = [...new Set(raw.map(parseIdValue))]
    if (wanted.some((v) => v === null)) return badRequest(res, 'categoryIds must be a list of category ids.')
    const unknown = wanted.filter((cid) => !getCategory(cid))
    if (unknown.length) return badRequest(res, `Unknown category id(s): ${unknown.join(', ')}.`)

    const before = companyCategories(id).map((c) => c.id)
    const added = wanted.filter((cid) => !before.includes(cid))
    const removed = before.filter((cid) => !wanted.includes(cid))
    if (added.length || removed.length) {
      transaction(db, () => {
        const del = db.prepare('DELETE FROM vendor_company_categories WHERE company_id = ? AND category_id = ?')
        const ins = db.prepare('INSERT INTO vendor_company_categories (company_id, category_id, assigned_by) VALUES (?, ?, ?)')
        for (const cid of removed) del.run(id, cid)
        for (const cid of added) ins.run(id, cid, req.staff.id)
        audit(db, {
          ...actor(req),
          action: 'vendor.categories',
          targetType: 'vendor_company',
          targetId: id,
          metadata: { added, removed },
        })
      })
    }
    res.json({ categories: companyCategories(id).map(toCategory) })
  })

  // ---- Vendor login accounts --------------------------------------------
  // Staff choose the username and the password. A staff-set password (create,
  // reset, reactivate) is a normal password: it stays valid until staff or the
  // vendor change it (vendors may change theirs voluntarily in the portal).

  function insertVendorUser(companyId, { name, username, role = 'client', hash }) {
    return Number(
      db
        .prepare(
          `INSERT INTO vendor_users (company_id, username, name, role, password_hash)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(companyId, username, name, role, hash).lastInsertRowid,
    )
  }

  router.post('/vendors/:id/users', async (req, res) => {
    const companyId = parseId(req.params.id)
    if (!companyId || !getCompany(companyId)) return notFound(res)
    const name = cleanText(req.body?.name, 200)
    if (!name) return badRequest(res, 'Name is required.')
    const role = req.body?.role ?? 'client'
    if (!ROLES.includes(role)) return badRequest(res, ROLE_RULE)
    const credentials = readCredentials(req.body)
    if (credentials.error) return res.status(credentials.status).json({ error: credentials.error })
    const hash = await hashPassword(credentials.password)
    let id
    try {
      id = insertVendorUser(companyId, { name, username: credentials.username, role, hash })
    } catch (error) {
      // e.g. a concurrent create took the username while the password was hashing
      if (isUniqueViolation(error)) return res.status(409).json({ error: USERNAME_TAKEN })
      throw error
    }
    audit(db, {
      ...actor(req),
      action: 'vendor_user.create',
      targetType: 'vendor_user',
      targetId: id,
      metadata: { companyId, username: credentials.username, role },
    })
    res.status(201).json({ user: toVendorUser(getVendorUser(id)) })
  })

  // Details and deactivation. A vendor user's company is fixed at creation.
  //   name, username — edit (also how an account created before migration 0003
  //                    gets a username; it cannot sign in until it has one)
  //   active: false  — deactivate: keeps the account, its company's categories and
  //                    every record; ends all sessions now; logins fail while inactive
  //   active: true   — refused for an inactive account: use POST .../reactivate,
  //                    which requires staff to set a new password
  //   password       — same effect as POST .../reset-password
  router.patch('/vendor-users/:id', async (req, res) => {
    const id = parseId(req.params.id)
    const user = id && getVendorUser(id)
    if (!user) return notFound(res)

    const body = req.body ?? {}
    const updates = {}
    if ('name' in body) {
      updates.name = cleanText(body.name, 200)
      if (!updates.name) return badRequest(res, 'Name is required.')
    }
    if ('role' in body) {
      if (!ROLES.includes(body.role)) return badRequest(res, ROLE_RULE)
      updates.role = body.role
    }
    if ('username' in body) {
      updates.username = normalizeUsername(body.username)
      if (!updates.username) return badRequest(res, USERNAME_RULE)
      if (usernameTaken(updates.username, id)) return res.status(409).json({ error: USERNAME_TAKEN })
    }
    if ('active' in body) {
      if (typeof body.active !== 'boolean') return badRequest(res, 'active must be true or false.')
      if (body.active === true && user.active !== 1) {
        return badRequest(res, 'Reactivating an account requires setting a new password. Use Reactivate.')
      }
      if (body.active === false) updates.active = 0
    }
    if ('password' in body) {
      const password = readNewPassword(body)
      if (password.error) return res.status(password.status).json({ error: password.error })
      updates.password_hash = await hashPassword(password.value)
    }
    const columns = Object.keys(updates)
    if (columns.length === 0) {
      // e.g. { active: true } on an already active account
      return res.json({ user: toVendorUser(user) })
    }

    try {
      transaction(db, () => {
        db.prepare(`UPDATE vendor_users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
          ...columns.map((c) => updates[c]),
          id,
        )
        if (updates.active === 0 || updates.password_hash) deleteUserSessions(db, 'vendor', id)
        audit(db, {
          ...actor(req),
          action: updates.active === 0 ? 'vendor_user.deactivate' : 'vendor_user.update',
          targetType: 'vendor_user',
          targetId: id,
          metadata: {
            fields: columns.map((c) => (c === 'password_hash' ? 'password' : c)),
          },
        })
      })
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: USERNAME_TAKEN })
      throw error
    }
    res.json({ user: toVendorUser(getVendorUser(id)) })
  })

  // Reactivates the SAME account (username, company and its categories unchanged)
  // with a new staff-chosen password. The old password stops working and old
  // sessions stay invalid; the vendor can sign in with the new one right away.
  router.post('/vendor-users/:id/reactivate', async (req, res) => {
    const id = parseId(req.params.id)
    const user = id && getVendorUser(id)
    if (!user) return notFound(res)
    if (user.active === 1) return res.status(409).json({ error: 'This account is already active.' })
    const password = readNewPassword(req.body)
    if (password.error) return res.status(password.status).json({ error: password.error })
    const hash = await hashPassword(password.value)
    transaction(db, () => {
      db.prepare('UPDATE vendor_users SET active = 1, password_hash = ? WHERE id = ?').run(hash, id)
      deleteUserSessions(db, 'vendor', id)
      audit(db, { ...actor(req), action: 'vendor_user.reactivate', targetType: 'vendor_user', targetId: id })
    })
    res.json({ user: toVendorUser(getVendorUser(id)) })
  })

  // Forgotten password (no email, no self-service recovery): staff set a new
  // password. Ends all sessions and does NOT change whether the account is active.
  router.post('/vendor-users/:id/reset-password', async (req, res) => {
    const id = parseId(req.params.id)
    const user = id && getVendorUser(id)
    if (!user) return notFound(res)
    const password = readNewPassword(req.body)
    if (password.error) return res.status(password.status).json({ error: password.error })
    const hash = await hashPassword(password.value)
    transaction(db, () => {
      db.prepare('UPDATE vendor_users SET password_hash = ? WHERE id = ?').run(hash, id)
      deleteUserSessions(db, 'vendor', id)
      audit(db, { ...actor(req), action: 'vendor_user.reset_password', targetType: 'vendor_user', targetId: id })
    })
    res.json({ user: toVendorUser(getVendorUser(id)) })
  })

  // ---- Inspection settings per company (signatories) ------------------------
  // Each stage is mapped to one explicit account of THIS company. Nobody holds
  // a stage by default; Head of Operation approval is the 'approved_by' stage.

  // What the published checklist templates print under each sign-off line
  // (e.g. "MGCSB, Inspector"). Shown to staff as guidance only: authority comes
  // from the account assigned below, never from these labels.
  function templateCaptions() {
    const out = { checked_by: new Set(), agreed_by: new Set(), approved_by: new Set() }
    const rows = db
      .prepare(
        `SELECT v.definition FROM checklist_template_versions v JOIN checklist_templates t ON t.id = v.template_id
          WHERE t.active = 1 AND v.state = 'published'
            AND v.version = (SELECT MAX(version) FROM checklist_template_versions w WHERE w.template_id = v.template_id AND w.state = 'published')`,
      )
      .all()
    for (const row of rows) {
      const signoff = JSON.parse(row.definition).signoff ?? {}
      for (const stage of Object.keys(out)) {
        const s = signoff[stage]
        const text = [s?.printedName, s?.caption && `(${s.caption})`].filter(Boolean).join(' ')
        if (text) out[stage].add(text)
      }
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]))
  }

  router.get('/vendors/:id/inspection-settings', (req, res) => {
    const id = parseId(req.params.id)
    const company = id && getCompany(id)
    if (!company) return notFound(res)
    res.json({
      signatories: signatoriesFor(db, id),
      ackBlocksApproval: company.inspection_ack_blocks_approval === 1,
      templateCaptions: templateCaptions(),
    })
  })

  router.put('/vendors/:id/inspection-settings', (req, res) => {
    const id = parseId(req.params.id)
    const company = id && getCompany(id)
    if (!company) return notFound(res)
    const body = req.body ?? {}
    const wanted = body.signatories ?? {}
    if (typeof wanted !== 'object' || Array.isArray(wanted)) return badRequest(res, 'signatories must be an object.')
    for (const key of Object.keys(wanted)) if (!STAGES.includes(key)) return badRequest(res, `Unknown stage “${key}”.`)
    const resolved = {}
    for (const stage of STAGES) {
      if (!(stage in wanted)) continue
      if (wanted[stage] === null || wanted[stage] === '') {
        resolved[stage] = null
        continue
      }
      const userId = parseIdValue(wanted[stage])
      const user = userId && getVendorUser(userId)
      if (!user || user.company_id !== id) return badRequest(res, `${STAGE_LABELS[stage]}: choose an account of ${company.name}.`)
      if (user.active !== 1) return badRequest(res, `${STAGE_LABELS[stage]}: ${user.name} is deactivated.`)
      resolved[stage] = user.id
    }
    if ('ackBlocksApproval' in body && typeof body.ackBlocksApproval !== 'boolean') {
      return badRequest(res, 'ackBlocksApproval must be true or false.')
    }
    transaction(db, () => {
      for (const [stage, userId] of Object.entries(resolved)) {
        if (userId === null) db.prepare('DELETE FROM inspection_signatories WHERE company_id = ? AND stage = ?').run(id, stage)
        else {
          db.prepare(
            `INSERT INTO inspection_signatories (company_id, stage, user_id, assigned_by) VALUES (?, ?, ?, ?)
             ON CONFLICT (company_id, stage) DO UPDATE SET user_id = excluded.user_id, assigned_by = excluded.assigned_by,
                                                         assigned_at = CURRENT_TIMESTAMP`,
          ).run(id, stage, userId, req.staff.id)
        }
      }
      if ('ackBlocksApproval' in body) {
        db.prepare('UPDATE vendor_companies SET inspection_ack_blocks_approval = ? WHERE id = ?').run(body.ackBlocksApproval ? 1 : 0, id)
      }
      audit(db, {
        ...actor(req),
        action: 'inspection.signatories',
        targetType: 'vendor_company',
        targetId: id,
        metadata: { signatories: resolved, ...('ackBlocksApproval' in body && { ackBlocksApproval: body.ackBlocksApproval }) },
      })
    })
    res.json({ signatories: signatoriesFor(db, id), ackBlocksApproval: getCompany(id).inspection_ack_blocks_approval === 1 })
  })

  // ---- Checklist templates ---------------------------------------------------
  // A template (vehicle type, name, active) has numbered versions. Staff edit a
  // version while it is a draft and publish it; published versions are frozen
  // (database trigger) and new inspections use the latest published one.
  // Existing inspections keep the version they were created from.

  const getTemplate = (id) => db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(id)
  const templateVersions = (id) => db.prepare('SELECT * FROM checklist_template_versions WHERE template_id = ? ORDER BY version DESC').all(id)
  const currentPublished = (id) =>
    db.prepare("SELECT * FROM checklist_template_versions WHERE template_id = ? AND state = 'published' ORDER BY version DESC LIMIT 1").get(id)
  const draftOf = (id) => db.prepare("SELECT * FROM checklist_template_versions WHERE template_id = ? AND state = 'draft'").get(id)
  const diagramExists = (id) => Boolean(getDiagram(db, id))

  const versionMeta = (v) =>
    v && {
      id: v.id,
      version: v.version,
      state: v.state,
      itemCount: itemCount(JSON.parse(v.definition)),
      imported: Boolean(v.source_hash),
      createdAt: v.created_at,
      updatedAt: v.updated_at,
      publishedAt: v.published_at,
    }
  const versionFull = (v) => v && { ...versionMeta(v), definition: JSON.parse(v.definition) }

  const toTemplate = (row) => {
    const current = currentPublished(row.id)
    const draft = draftOf(row.id)
    return {
      id: row.id,
      vehicleType: row.vehicle_type,
      name: row.name,
      active: row.active === 1,
      imported: Boolean(row.seed_key),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      current: versionMeta(current) ?? null,
      draft: versionMeta(draft) ?? null,
      inspectionCount: db.prepare('SELECT COUNT(*) AS n FROM inspections WHERE template_id = ?').get(row.id).n,
    }
  }

  function readDefinition(input) {
    try {
      return { definition: normalizeDefinition(input, { diagramExists }) }
    } catch (error) {
      if (error instanceof DefinitionError) return { error: error.message }
      throw error
    }
  }

  // A blank form for a new template: the vehicle-detail fields and the status
  // legend are left for staff to fill in — nothing is assumed.
  const emptyDefinition = () =>
    normalizeDefinition({
      header: { companyName: '', title: '', subtitle: '', showLogos: false },
      details: Object.keys(DETAIL_FIELDS).map((key) => ({ key, default: '', required: false })),
      statusLegend: [],
      sections: [],
      footer: { remarks: true, nextServicing: false },
      damage: { enabled: false },
    })

  router.get('/checklist-templates', (req, res) => {
    const rows = db.prepare('SELECT * FROM checklist_templates ORDER BY vehicle_type, name COLLATE NOCASE').all()
    res.json({ templates: rows.map(toTemplate), vehicleTypes: VEHICLE_TYPES })
  })

  router.get('/checklist-templates/:id', (req, res) => {
    const id = parseId(req.params.id)
    const row = id && getTemplate(id)
    if (!row) return notFound(res)
    res.json({
      template: toTemplate(row),
      versions: templateVersions(id).map(versionMeta),
      current: versionFull(currentPublished(id)) ?? null,
      draft: versionFull(draftOf(id)) ?? null,
    })
  })

  router.get('/checklist-templates/:id/versions/:versionId', (req, res) => {
    const id = parseId(req.params.id)
    const versionId = parseId(req.params.versionId)
    const v = id && versionId && db.prepare('SELECT * FROM checklist_template_versions WHERE id = ? AND template_id = ?').get(versionId, id)
    if (!v) return notFound(res)
    res.json({ version: versionFull(v) })
  })

  // Creates the template with a draft version 1 (from `definition`, or blank).
  router.post('/checklist-templates', (req, res) => {
    const body = req.body ?? {}
    if (!VEHICLE_TYPES.includes(body.vehicleType)) return badRequest(res, 'Choose a vehicle type.')
    const name = cleanText(body.name, 200)
    if (!name) return badRequest(res, 'Template name is required.')
    let definition = emptyDefinition()
    if (body.definition !== undefined) {
      const read = readDefinition(body.definition)
      if (read.error) return badRequest(res, read.error)
      definition = read.definition
    }
    const id = transaction(db, () => {
      const newId = Number(
        db
          .prepare('INSERT INTO checklist_templates (vehicle_type, name, status_options, active, created_by) VALUES (?, ?, ?, 1, ?)')
          .run(body.vehicleType, name, JSON.stringify(definition.statusLegend.map((s) => s.value)), req.staff.id).lastInsertRowid,
      )
      db.prepare("INSERT INTO checklist_template_versions (template_id, version, state, definition, created_by) VALUES (?, 1, 'draft', ?, ?)").run(
        newId,
        JSON.stringify(definition),
        req.staff.id,
      )
      audit(db, { ...actor(req), action: 'template.create', targetType: 'checklist_template', targetId: newId, metadata: { name } })
      return newId
    })
    res.status(201).json({ template: toTemplate(getTemplate(id)), draft: versionFull(draftOf(id)) })
  })

  // Name / vehicle type / active. Affects inspections created afterwards only.
  router.patch('/checklist-templates/:id', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getTemplate(id)) return notFound(res)
    const body = req.body ?? {}
    const fields = {}
    if ('vehicleType' in body) {
      if (!VEHICLE_TYPES.includes(body.vehicleType)) return badRequest(res, 'Choose a vehicle type.')
      fields.vehicle_type = body.vehicleType
    }
    if ('name' in body) {
      fields.name = cleanText(body.name, 200)
      if (!fields.name) return badRequest(res, 'Template name is required.')
    }
    if ('active' in body) {
      if (typeof body.active !== 'boolean') return badRequest(res, 'active must be true or false.')
      fields.active = body.active ? 1 : 0
    }
    const columns = Object.keys(fields)
    if (!columns.length) return badRequest(res, 'Nothing to update.')
    transaction(db, () => {
      db.prepare(`UPDATE checklist_templates SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        ...columns.map((c) => fields[c]),
        id,
      )
      audit(db, { ...actor(req), action: 'template.update', targetType: 'checklist_template', targetId: id, metadata: { fields: columns } })
    })
    res.json({ template: toTemplate(getTemplate(id)) })
  })

  // Saves the draft. Without a draft, starts the next version (copy of the
  // body's definition). Published versions are never edited.
  router.put('/checklist-templates/:id/draft', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getTemplate(id)) return notFound(res)
    const read = readDefinition(req.body?.definition)
    if (read.error) return badRequest(res, read.error)
    const json = JSON.stringify(read.definition)
    transaction(db, () => {
      const draft = draftOf(id)
      if (draft) {
        db.prepare('UPDATE checklist_template_versions SET definition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(json, draft.id)
      } else {
        const next = (db.prepare('SELECT MAX(version) AS v FROM checklist_template_versions WHERE template_id = ?').get(id).v ?? 0) + 1
        db.prepare("INSERT INTO checklist_template_versions (template_id, version, state, definition, created_by) VALUES (?, ?, 'draft', ?, ?)").run(
          id,
          next,
          json,
          req.staff.id,
        )
      }
      db.prepare('UPDATE checklist_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
      audit(db, { ...actor(req), action: 'template.draft_saved', targetType: 'checklist_template', targetId: id })
    })
    res.json({ template: toTemplate(getTemplate(id)), draft: versionFull(draftOf(id)) })
  })

  router.delete('/checklist-templates/:id/draft', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getTemplate(id)) return notFound(res)
    const draft = draftOf(id)
    if (!draft) return notFound(res)
    if (!currentPublished(id)) return res.status(409).json({ error: 'This template has never been published; its first draft cannot be discarded.' })
    transaction(db, () => {
      db.prepare('DELETE FROM checklist_template_versions WHERE id = ?').run(draft.id)
      audit(db, { ...actor(req), action: 'template.draft_discarded', targetType: 'checklist_template', targetId: id, metadata: { version: draft.version } })
    })
    res.json({ template: toTemplate(getTemplate(id)) })
  })

  router.post('/checklist-templates/:id/publish', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getTemplate(id)) return notFound(res)
    const draft = draftOf(id)
    if (!draft) return res.status(409).json({ error: 'There is no draft to publish.' })
    const definition = JSON.parse(draft.definition)
    // Re-check against current data (e.g. a diagram must still exist).
    const read = readDefinition(definition)
    if (read.error) return badRequest(res, read.error)
    const problems = publishProblems(read.definition)
    if (problems.length) return res.status(400).json({ error: problems[0], problems })
    transaction(db, () => {
      db.prepare(
        "UPDATE checklist_template_versions SET state = 'published', published_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(req.staff.id, draft.id)
      db.prepare('UPDATE checklist_templates SET status_options = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        JSON.stringify(read.definition.statusLegend.map((s) => s.value)),
        id,
      )
      audit(db, { ...actor(req), action: 'template.published', targetType: 'checklist_template', targetId: id, metadata: { version: draft.version } })
    })
    res.json({ template: toTemplate(getTemplate(id)), current: versionFull(currentPublished(id)) })
  })

  // ---- Damage diagrams -------------------------------------------------------

  router.get('/checklist-diagrams', (req, res) => {
    const rows = db.prepare('SELECT * FROM checklist_diagrams ORDER BY vehicle_type, name COLLATE NOCASE, id').all()
    res.json({ diagrams: rows.map((r) => toDiagram(r)) })
  })

  // Upload (multipart "image"); name and vehicle type come as query parameters.
  router.post('/checklist-diagrams', async (req, res) => {
    const name = cleanText(req.query.name, 120)
    if (!name) return badRequest(res, 'Give the diagram a name.')
    const vehicleType = req.query.vehicleType ? String(req.query.vehicleType) : null
    if (vehicleType && !VEHICLE_TYPES.includes(vehicleType)) return badRequest(res, 'Choose a valid vehicle type.')
    const { buffer, type } = await receiveImage(req, res)
    if (type === 'image/gif') return badRequest(res, 'Use a PNG, JPEG or WebP image for diagrams.')
    const file = diagrams.save(buffer, type)
    try {
      const id = transaction(db, () => {
        const newId = Number(
          db
            .prepare('INSERT INTO checklist_diagrams (name, vehicle_type, file, mime_type, source, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            .run(name, vehicleType, file, type, 'Uploaded by staff', req.staff.id).lastInsertRowid,
        )
        audit(db, { ...actor(req), action: 'diagram.upload', targetType: 'checklist_diagram', targetId: newId, metadata: { name } })
        return newId
      })
      res.status(201).json({ diagram: toDiagram(getDiagram(db, id)) })
    } catch (error) {
      diagrams.remove(file)
      throw error
    }
  })

  router.get('/checklist-diagrams/:id/image', (req, res) => {
    const id = parseId(req.params.id)
    const row = id && getDiagram(db, id)
    if (!row) return notFound(res)
    res.set('Cache-Control', 'private, max-age=3600')
    sendDiagram(res, diagrams, row)
  })

  // ---- Inspections (staff create and assign; vendors work them in the portal) ----

  router.get('/inspections', (req, res) => {
    const where = []
    const params = []
    if (req.query.companyId) {
      const companyId = parseId(String(req.query.companyId))
      if (!companyId) return badRequest(res, 'Invalid company filter.')
      where.push('i.company_id = ?')
      params.push(companyId)
    }
    if (req.query.status) {
      if (!INSPECTION_STATUSES.includes(req.query.status)) return badRequest(res, 'Invalid status filter.')
      where.push('i.status = ?')
      params.push(req.query.status)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const { page, limit, offset } = parsePagination(req)
    const total = db.prepare(`SELECT COUNT(*) AS n FROM inspections i ${clause}`).get(...params).n
    const rows = db
      .prepare(
        `SELECT i.*, c.name AS company_name FROM inspections i JOIN vendor_companies c ON c.id = i.company_id
          ${clause} ORDER BY i.updated_at DESC, i.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset)
    res.json({ inspections: rows.map((row) => listRow(db, row)), pagination: paginationMeta({ page, limit, total }) })
  })

  function readVehicle(body, { partial }) {
    const fields = {}
    for (const [key, column] of [
      ['vehiclePlate', 'vehicle_plate'],
      ['vehicleRegistrationNo', 'vehicle_registration_no'],
      ['modRegistrationNo', 'mod_registration_no'],
    ]) {
      if (!partial || key in body) fields[column] = cleanText(body[key], 60) || null
    }
    return fields
  }

  router.post('/inspections', (req, res) => {
    const body = req.body ?? {}
    const companyId = parseIdValue(body.companyId)
    const company = companyId && getCompany(companyId)
    if (!company) return badRequest(res, 'Choose a vendor / company.')
    const inspectorId = parseIdValue(body.inspectorId)
    const inspector = inspectorId && getVendorUser(inspectorId)
    if (!inspector || inspector.company_id !== companyId || inspector.role !== 'inspector' || inspector.active !== 1) {
      return badRequest(res, `Choose an active Inspector account of ${company.name}.`)
    }
    const templateId = parseIdValue(body.templateId)
    const template = templateId && getTemplate(templateId)
    if (!template || template.active !== 1) return badRequest(res, 'Choose an active checklist template.')
    const version = currentPublished(templateId)
    if (!version) return badRequest(res, 'That template has no published version yet.')
    const definition = JSON.parse(version.definition)
    if (itemCount(definition) === 0) return badRequest(res, 'That template has no checklist items yet.')
    const vehicle = readVehicle(body, { partial: false })
    if (!vehicle.vehicle_plate && !vehicle.vehicle_registration_no && !vehicle.mod_registration_no) {
      return badRequest(res, 'Enter at least one vehicle identifier (plate, registration no. or MOD registration no.).')
    }
    const id = transaction(db, () => {
      const newId = Number(
        db
          .prepare(
            `INSERT INTO inspections (company_id, inspector_id, template_id, template_name, status_options, vehicle_type,
                                      vehicle_plate, vehicle_registration_no, mod_registration_no, created_by,
                                      template_version_id, template_version, form_definition, form_answers)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            companyId,
            inspectorId,
            templateId,
            template.name,
            JSON.stringify(definition.statusLegend.map((s) => s.value)),
            template.vehicle_type,
            vehicle.vehicle_plate,
            vehicle.vehicle_registration_no,
            vehicle.mod_registration_no,
            req.staff.id,
            version.id,
            version.version,
            version.definition,
            JSON.stringify(initialAnswers(definition)),
          ).lastInsertRowid,
      )
      recordEvent(db, { inspectionId: newId, actorType: 'staff', actorId: req.staff.id, actorName: req.staff.name, action: 'created', detail: `Assigned to ${inspector.name}` })
      audit(db, {
        ...actor(req),
        action: 'inspection.create',
        targetType: 'inspection',
        targetId: newId,
        metadata: { companyId, inspectorId, templateId, templateVersion: version.version },
      })
      return newId
    })
    res.status(201).json({ inspection: serializeInspection(db, getInspection(db, id), { includeWorking: true }) })
  })

  router.get('/inspections/:id', (req, res) => {
    const id = parseId(req.params.id)
    const inspection = id && getInspection(db, id)
    if (!inspection) return notFound(res)
    const inspectors = db
      .prepare("SELECT id, name, username FROM vendor_users WHERE company_id = ? AND role = 'inspector' AND active = 1 ORDER BY name COLLATE NOCASE")
      .all(inspection.company_id)
    res.json({ inspection: serializeInspection(db, inspection, { includeWorking: true }), inspectors })
  })

  router.get('/inspections/:id/revisions/:revision', (req, res) => {
    const id = parseId(req.params.id)
    const inspection = id && getInspection(db, id)
    if (!inspection) return notFound(res)
    const number = parseId(req.params.revision)
    const revision = number && serializeRevision(db, inspection, number)
    if (!revision) return notFound(res)
    res.json({ revision })
  })

  // Reassign the inspector / correct vehicle identifiers while the checklist is
  // still with the inspector. Submitted revisions are never changed.
  router.patch('/inspections/:id', (req, res) => {
    const id = parseId(req.params.id)
    const inspection = id && getInspection(db, id)
    if (!inspection) return notFound(res)
    if (!EDITABLE.includes(inspection.status)) {
      return res.status(409).json({ error: 'Only inspections still with the inspector (assigned, draft or returned) can be changed.' })
    }
    const body = req.body ?? {}
    const updates = readVehicle(body, { partial: true })
    let inspectorName
    if ('inspectorId' in body) {
      const inspector = getVendorUser(parseIdValue(body.inspectorId) ?? 0)
      if (!inspector || inspector.company_id !== inspection.company_id || inspector.role !== 'inspector' || inspector.active !== 1) {
        return badRequest(res, 'Choose an active Inspector account of the same company.')
      }
      updates.inspector_id = inspector.id
      inspectorName = inspector.name
    }
    const columns = Object.keys(updates)
    if (!columns.length) return badRequest(res, 'Nothing to update.')
    const merged = { ...inspection, ...updates }
    if (!merged.vehicle_plate && !merged.vehicle_registration_no && !merged.mod_registration_no) {
      return badRequest(res, 'Keep at least one vehicle identifier.')
    }
    transaction(db, () => {
      db.prepare(`UPDATE inspections SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        ...columns.map((c) => updates[c]),
        id,
      )
      recordEvent(db, {
        inspectionId: id,
        actorType: 'staff',
        actorId: req.staff.id,
        actorName: req.staff.name,
        action: 'updated',
        detail: inspectorName ? `Reassigned to ${inspectorName}` : 'Vehicle details updated',
      })
      audit(db, { ...actor(req), action: 'inspection.update', targetType: 'inspection', targetId: id, metadata: { fields: columns } })
    })
    res.json({ inspection: serializeInspection(db, getInspection(db, id), { includeWorking: true }) })
  })

  // ---- Categories ---------------------------------------------------------

  router.get('/categories', (req, res) => {
    const rows = db
      .prepare(
        `SELECT cg.*,
                (SELECT COUNT(*) FROM catalogs c WHERE c.category_id = cg.id) AS listing_count,
                (SELECT COUNT(*) FROM catalogs c WHERE c.category_id = cg.id AND c.status = 'published') AS published_count,
                (SELECT COUNT(*) FROM vendor_company_categories v WHERE v.category_id = cg.id) AS vendor_count
           FROM categories cg
          ORDER BY cg.name COLLATE NOCASE`,
      )
      .all()
    res.json({ categories: rows.map(toCategory) })
  })

  router.post('/categories', (req, res) => {
    const normalized = normalizeCategoryName(req.body?.name)
    if (!normalized) return badRequest(res, 'Category name is required (max 100 characters).')
    const description = cleanText(req.body?.description, 1000) || null
    const active = req.body?.active === undefined ? 1 : req.body.active === true ? 1 : req.body.active === false ? 0 : null
    if (active === null) return badRequest(res, 'active must be true or false.')
    const duplicate = (existing = normalized) =>
      res.status(409).json({ error: `A category named "${existing.name}" already exists.` })
    const existing = categoryKeyTaken(normalized.key)
    if (existing) return duplicate(existing)
    let id
    try {
      id = Number(
        db
          .prepare('INSERT INTO categories (name, name_key, description, active, created_by) VALUES (?, ?, ?, ?, ?)')
          .run(normalized.name, normalized.key, description, active, req.staff.id).lastInsertRowid,
      )
    } catch (error) {
      if (isUniqueViolation(error)) return duplicate()
      throw error
    }
    audit(db, { ...actor(req), action: 'category.create', targetType: 'category', targetId: id, metadata: { name: normalized.name } })
    res.status(201).json({ category: toCategory(getCategory(id)) })
  })

  router.patch('/categories/:id', (req, res) => {
    const id = parseId(req.params.id)
    if (!id || !getCategory(id)) return notFound(res)
    const body = req.body ?? {}
    const updates = {}
    if ('name' in body) {
      const normalized = normalizeCategoryName(body.name)
      if (!normalized) return badRequest(res, 'Category name is required (max 100 characters).')
      const existing = categoryKeyTaken(normalized.key, id)
      if (existing) return res.status(409).json({ error: `A category named "${existing.name}" already exists.` })
      updates.name = normalized.name
      updates.name_key = normalized.key
    }
    if ('description' in body) updates.description = cleanText(body.description, 1000) || null
    if ('active' in body) {
      if (typeof body.active !== 'boolean') return badRequest(res, 'active must be true or false.')
      updates.active = body.active ? 1 : 0
    }
    const columns = Object.keys(updates)
    if (columns.length === 0) return badRequest(res, 'Nothing to update.')
    try {
      db.prepare(
        `UPDATE categories SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).run(...columns.map((c) => updates[c]), id)
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: `A category named "${updates.name}" already exists.` })
      throw error
    }
    const logged = { ...updates }
    delete logged.name_key
    audit(db, { ...actor(req), action: 'category.update', targetType: 'category', targetId: id, metadata: logged })
    res.json({ category: toCategory(getCategory(id)) })
  })

  // Only an unused category can be deleted; otherwise explain what to move.
  router.delete('/categories/:id', (req, res) => {
    const id = parseId(req.params.id)
    const category = id && getCategory(id)
    if (!category) return notFound(res)
    const listings = db.prepare('SELECT COUNT(*) AS n FROM catalogs WHERE category_id = ?').get(id).n
    const vendors = db.prepare('SELECT COUNT(*) AS n FROM vendor_company_categories WHERE category_id = ?').get(id).n
    if (listings || vendors) {
      const parts = []
      if (listings) parts.push(`move its ${listings} listing${listings === 1 ? '' : 's'} (including archived) to another category`)
      if (vendors) parts.push(`remove it from ${vendors} vendor${vendors === 1 ? '' : 's'}`)
      return res.status(409).json({
        error: `"${category.name}" is still in use. To delete it, first ${parts.join(' and ')} — or deactivate it instead.`,
        listingCount: listings,
        vendorCount: vendors,
      })
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    audit(db, { ...actor(req), action: 'category.delete', targetType: 'category', targetId: id, metadata: { name: category.name } })
    res.status(204).end()
  })

  // ---- Catalog listings ---------------------------------------------------

  router.get('/listings', (req, res) => {
    const where = []
    const params = []
    const term = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : ''
    if (term) {
      const pattern = `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
      where.push(`(cat.title LIKE ? ESCAPE '\\' OR cat.description LIKE ? ESCAPE '\\')`)
      params.push(pattern, pattern)
    }
    if (req.query.categoryId !== undefined && req.query.categoryId !== '') {
      const categoryId = parseId(req.query.categoryId)
      if (!categoryId) return badRequest(res, 'Invalid category filter.')
      where.push('cat.category_id = ?')
      params.push(categoryId)
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      if (!LISTING_STATUSES.includes(req.query.status)) return badRequest(res, 'Invalid status filter.')
      where.push('cat.status = ?')
      params.push(req.query.status)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const { page, limit, offset } = parsePagination(req)
    const total = db.prepare(`SELECT COUNT(*) AS n FROM catalogs cat ${clause}`).get(...params).n
    const rows = db
      .prepare(`${LISTING_SELECT} ${clause} ORDER BY cat.updated_at DESC, cat.id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)
    res.json({ listings: rows.map(toListing), pagination: paginationMeta({ page, limit, total }) })
  })

  function readListingFields(body, { partial }) {
    const fields = {}
    if (!partial || 'title' in body) {
      fields.title = cleanText(body.title, 200)
      if (!fields.title) return { error: 'Title is required.' }
    }
    if (!partial || 'description' in body) fields.description = cleanText(body.description, 5000) || null
    if (!partial || 'categoryId' in body) {
      const categoryId = parseIdValue(body.categoryId)
      if (!categoryId) return { error: 'Choose a category.' }
      if (!getCategory(categoryId)) return { error: 'That category does not exist.' }
      fields.category_id = categoryId
    }
    if (!partial || 'price' in body) {
      const priceCents = parsePrice(body.price)
      if (priceCents === undefined) return { error: 'Price must be a number with up to 2 decimals, or empty.' }
      fields.price_cents = priceCents
    }
    if ('status' in body || !partial) {
      const status = body.status ?? 'draft'
      if (!LISTING_STATUSES.includes(status)) return { error: 'Invalid status.' }
      if (!partial && status === 'archived') return { error: 'A new listing can only be a draft or published.' }
      fields.status = status
    }
    return { fields }
  }

  router.post('/listings', (req, res) => {
    const { error, fields } = readListingFields(req.body ?? {}, { partial: false })
    if (error) return badRequest(res, error)
    const id = Number(
      db
        .prepare(
          `INSERT INTO catalogs (title, description, category_id, price_cents, status, published_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP END, ?, ?)`,
        )
        .run(fields.title, fields.description, fields.category_id, fields.price_cents, fields.status, fields.status, req.staff.id, req.staff.id)
        .lastInsertRowid,
    )
    audit(db, {
      ...actor(req),
      action: 'listing.create',
      targetType: 'catalog',
      targetId: id,
      metadata: { title: fields.title, categoryId: fields.category_id, status: fields.status },
    })
    res.status(201).json({ listing: toListing(getListing(id)) })
  })

  router.get('/listings/:id', (req, res) => {
    const id = parseId(req.params.id)
    const listing = id && getListing(id)
    if (!listing) return notFound(res)
    res.json({ listing: toListing(listing) })
  })

  router.patch('/listings/:id', (req, res) => {
    const id = parseId(req.params.id)
    const current = id && getListing(id)
    if (!current) return notFound(res)
    const { error, fields } = readListingFields(req.body ?? {}, { partial: true })
    if (error) return badRequest(res, error)
    const columns = Object.keys(fields)
    if (columns.length === 0) return badRequest(res, 'Nothing to update.')
    // A legacy listing without a category cannot be published until it has one.
    if (fields.status === 'published' && !(fields.category_id ?? current.category_id)) {
      return badRequest(res, 'Choose a category before publishing.')
    }
    const becamePublished = fields.status === 'published' && current.status !== 'published'
    db.prepare(
      `UPDATE catalogs SET ${columns.map((c) => `${c} = ?`).join(', ')},
              ${becamePublished ? 'published_at = CURRENT_TIMESTAMP,' : ''}
              updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).run(...columns.map((c) => fields[c]), req.staff.id, id)
    audit(db, {
      ...actor(req),
      action: fields.status && fields.status !== current.status ? `listing.${fields.status}` : 'listing.update',
      targetType: 'catalog',
      targetId: id,
      metadata: { fields: columns, ...(fields.status && { from: current.status, to: fields.status }) },
    })
    res.json({ listing: toListing(getListing(id)) })
  })

  router.put('/listings/:id/image', async (req, res) => {
    const id = parseId(req.params.id)
    const current = id && getListing(id)
    if (!current) return notFound(res)
    const { buffer, type } = await receiveImage(req, res)
    const file = images.save(buffer, type)
    db.prepare(
      'UPDATE catalogs SET image_file = ?, image_type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(file, type, req.staff.id, id)
    images.remove(current.image_file)
    audit(db, { ...actor(req), action: 'listing.image', targetType: 'catalog', targetId: id, metadata: { type, bytes: buffer.length } })
    res.json({ listing: toListing(getListing(id)) })
  })

  router.delete('/listings/:id/image', (req, res) => {
    const id = parseId(req.params.id)
    const current = id && getListing(id)
    if (!current) return notFound(res)
    if (current.image_file) {
      db.prepare(
        'UPDATE catalogs SET image_file = NULL, image_type = NULL, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(req.staff.id, id)
      images.remove(current.image_file)
      audit(db, { ...actor(req), action: 'listing.image_remove', targetType: 'catalog', targetId: id })
    }
    res.json({ listing: toListing(getListing(id)) })
  })

  router.get('/listings/:id/image', (req, res) => {
    const id = parseId(req.params.id)
    const listing = id && getListing(id)
    if (!listing?.image_file) return notFound(res)
    sendImage(res, images, listing.image_file, listing.image_type)
  })

  return router
}
