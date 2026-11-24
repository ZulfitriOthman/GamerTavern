// Verifies the catalog visibility rule at the data layer (catalogAccess.js):
// published + active category + category assigned to the company + company active.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import {
  countVisibleCatalogs,
  getVisibleCatalog,
  listVisibleCatalogs,
  listVisibleCategories,
} from '../src/catalogAccess.js'
import { createTestDatabase } from './helpers.js'

async function seed(db) {
  // Each test starts from the same rows (children first, for the foreign keys).
  for (const table of ['mashoor_vendor_company_categories', 'mashoor_catalog_assignments', 'mashoor_catalogs', 'mashoor_categories', 'mashoor_vendor_companies']) {
    await db.exec(`DELETE FROM ${table}`)
  }
  const company = async (name) => Number((await db.prepare('INSERT INTO mashoor_vendor_companies (name) VALUES (?)').run(name)).lastInsertRowid)
  const category = async (name, active = 1) =>
    Number((await db.prepare('INSERT INTO mashoor_categories (name, name_key, active) VALUES (?, ?, ?)').run(name, name.toLowerCase(), active)).lastInsertRowid)
  const listing = async (title, categoryId, status, description = null) =>
    Number(
      (
        await db
          .prepare(
            `INSERT INTO mashoor_catalogs (title, description, category_id, status, published_at)
             VALUES (?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP END)`,
          )
          .run(title, description, categoryId, status, status)
      ).lastInsertRowid,
    )
  const assign = (companyId, categoryId) =>
    db.prepare('INSERT INTO mashoor_vendor_company_categories (company_id, category_id) VALUES (?, ?)').run(companyId, categoryId)

  const ids = {
    vendorA: await company('Vendor A'),
    vendorB: await company('Vendor B'),
    vendorC: await company('Vendor C'),
    chairs: await category('Chairs'),
    desks: await category('Desks'),
    lamps: await category('Lamps'),
  }
  ids.chair1 = await listing('Ergo Chair', ids.chairs, 'published', 'Office furniture 2026')
  ids.chairDraft = await listing('Chair draft', ids.chairs, 'draft')
  ids.chairArchived = await listing('Old chair', ids.chairs, 'archived')
  ids.desk1 = await listing('Standing Desk', ids.desks, 'published')
  ids.lamp1 = await listing('Desk Lamp', ids.lamps, 'published')
  ids.uncategorized = await listing('Legacy catalog', null, 'published')
  await assign(ids.vendorA, ids.chairs)
  await assign(ids.vendorA, ids.desks)
  await assign(ids.vendorB, ids.chairs)
  // vendorC: no categories
  return { db, assign, ...ids }
}

const titles = (rows) => rows.map((r) => r.title).sort()

describe('catalog visibility (category assignments)', () => {
  let testDb
  let db
  let s
  before(async () => {
    testDb = await createTestDatabase()
    db = await testDb.open({ importChecklists: false })
  })
  after(async () => {
    await db.close()
    await testDb.drop()
  })
  beforeEach(async () => {
    s = await seed(db)
  })

  it('a vendor sees only published listings in its assigned categories', async () => {
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorA)), ['Ergo Chair', 'Standing Desk'])
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorB)), ['Ergo Chair'])
    assert.equal(await countVisibleCatalogs(s.db, s.vendorA), 2)
    assert.ok(await getVisibleCatalog(s.db, s.vendorA, s.desk1))
    assert.equal(await getVisibleCatalog(s.db, s.vendorB, s.desk1), undefined)
    assert.equal(await getVisibleCatalog(s.db, s.vendorA, s.lamp1), undefined)
  })

  it('a vendor with no categories sees nothing', async () => {
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorC), [])
    assert.deepEqual(await listVisibleCategories(s.db, s.vendorC), [])
    assert.equal(await getVisibleCatalog(s.db, s.vendorC, s.chair1), undefined)
  })

  it('drafts, archived and uncategorized listings are never visible', async () => {
    for (const id of [s.chairDraft, s.chairArchived, s.uncategorized]) {
      assert.equal(await getVisibleCatalog(s.db, s.vendorA, id), undefined)
    }
    await s.db.prepare("UPDATE mashoor_catalogs SET status = 'published' WHERE id = ?").run(s.chairDraft)
    assert.ok(await getVisibleCatalog(s.db, s.vendorA, s.chairDraft))
    await s.db.prepare("UPDATE mashoor_catalogs SET status = 'draft' WHERE id = ?").run(s.chairDraft)
    assert.equal(await getVisibleCatalog(s.db, s.vendorA, s.chairDraft), undefined)
  })

  it('search and the category filter never widen the result set', async () => {
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorA, { search: 'furniture' })), ['Ergo Chair'])
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorB, { search: 'Desk' }), [])
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorB, { search: '%' }), [])
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorB, { categoryId: s.desks }), [])
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorA, { categoryId: s.lamps }), [])
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorA, { categoryId: s.desks })), ['Standing Desk'])
    // LIKE wildcards in a search are literal characters.
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorA, { search: '_' }), [])
  })

  it('changing assignments changes visibility immediately', async () => {
    await s.db.prepare('DELETE FROM mashoor_vendor_company_categories WHERE company_id = ? AND category_id = ?').run(s.vendorB, s.chairs)
    assert.equal(await getVisibleCatalog(s.db, s.vendorB, s.chair1), undefined)
    assert.ok(await getVisibleCatalog(s.db, s.vendorA, s.chair1))
    await s.assign(s.vendorB, s.lamps)
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorB)), ['Desk Lamp'])
  })

  it('an inactive category hides its listings and drops out of the category list', async () => {
    await s.db.prepare('UPDATE mashoor_categories SET active = 0 WHERE id = ?').run(s.chairs)
    assert.deepEqual(titles(await listVisibleCatalogs(s.db, s.vendorA)), ['Standing Desk'])
    assert.deepEqual(
      (await listVisibleCategories(s.db, s.vendorA)).map((c) => c.name),
      ['Desks'],
    )
  })

  it('a suspended company sees nothing; others are unaffected', async () => {
    await s.db.prepare("UPDATE mashoor_vendor_companies SET status = 'suspended' WHERE id = ?").run(s.vendorA)
    assert.deepEqual(await listVisibleCatalogs(s.db, s.vendorA), [])
    assert.deepEqual(await listVisibleCategories(s.db, s.vendorA), [])
    assert.ok(await getVisibleCatalog(s.db, s.vendorB, s.chair1))
  })

  it('legacy per-catalog assignments grant nothing', async () => {
    await s.db.prepare('INSERT INTO mashoor_catalog_assignments (catalog_id, company_id) VALUES (?, ?)').run(s.lamp1, s.vendorC)
    assert.equal(await getVisibleCatalog(s.db, s.vendorC, s.lamp1), undefined)
  })

  it('assignments are unique per company/category pair', async () => {
    await assert.rejects(() => s.assign(s.vendorA, s.chairs), { code: 'ER_DUP_ENTRY' })
  })
})
