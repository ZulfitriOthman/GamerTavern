// Verifies the catalog visibility rule at the data layer (catalogAccess.js):
// published + active category + category assigned to the company + company active.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { openDatabase } from '../src/db.js'
import {
  countVisibleCatalogs,
  getVisibleCatalog,
  listVisibleCatalogs,
  listVisibleCategories,
} from '../src/catalogAccess.js'

function seed() {
  const db = openDatabase(':memory:')
  const company = (name) => Number(db.prepare('INSERT INTO vendor_companies (name) VALUES (?)').run(name).lastInsertRowid)
  const category = (name, active = 1) =>
    Number(
      db.prepare('INSERT INTO categories (name, name_key, active) VALUES (?, ?, ?)').run(name, name.toLowerCase(), active)
        .lastInsertRowid,
    )
  const listing = (title, categoryId, status, description = null) =>
    Number(
      db
        .prepare(
          `INSERT INTO catalogs (title, description, category_id, status, published_at)
           VALUES (?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP END)`,
        )
        .run(title, description, categoryId, status, status).lastInsertRowid,
    )
  const assign = (companyId, categoryId) =>
    db.prepare('INSERT INTO vendor_company_categories (company_id, category_id) VALUES (?, ?)').run(companyId, categoryId)

  const ids = {
    vendorA: company('Vendor A'),
    vendorB: company('Vendor B'),
    vendorC: company('Vendor C'),
    chairs: category('Chairs'),
    desks: category('Desks'),
    lamps: category('Lamps'),
  }
  ids.chair1 = listing('Ergo Chair', ids.chairs, 'published', 'Office furniture 2026')
  ids.chairDraft = listing('Chair draft', ids.chairs, 'draft')
  ids.chairArchived = listing('Old chair', ids.chairs, 'archived')
  ids.desk1 = listing('Standing Desk', ids.desks, 'published')
  ids.lamp1 = listing('Desk Lamp', ids.lamps, 'published')
  ids.uncategorized = listing('Legacy catalog', null, 'published')
  assign(ids.vendorA, ids.chairs)
  assign(ids.vendorA, ids.desks)
  assign(ids.vendorB, ids.chairs)
  // vendorC: no categories
  return { db, assign, ...ids }
}

const titles = (rows) => rows.map((r) => r.title).sort()

describe('catalog visibility (category assignments)', () => {
  let s
  beforeEach(() => {
    s = seed()
  })

  it('a vendor sees only published listings in its assigned categories', () => {
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorA)), ['Ergo Chair', 'Standing Desk'])
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorB)), ['Ergo Chair'])
    assert.equal(countVisibleCatalogs(s.db, s.vendorA), 2)
    assert.ok(getVisibleCatalog(s.db, s.vendorA, s.desk1))
    assert.equal(getVisibleCatalog(s.db, s.vendorB, s.desk1), undefined)
    assert.equal(getVisibleCatalog(s.db, s.vendorA, s.lamp1), undefined)
  })

  it('a vendor with no categories sees nothing', () => {
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorC), [])
    assert.deepEqual(listVisibleCategories(s.db, s.vendorC), [])
    assert.equal(getVisibleCatalog(s.db, s.vendorC, s.chair1), undefined)
  })

  it('drafts, archived and uncategorized listings are never visible', () => {
    for (const id of [s.chairDraft, s.chairArchived, s.uncategorized]) {
      assert.equal(getVisibleCatalog(s.db, s.vendorA, id), undefined)
    }
    s.db.prepare("UPDATE catalogs SET status = 'published' WHERE id = ?").run(s.chairDraft)
    assert.ok(getVisibleCatalog(s.db, s.vendorA, s.chairDraft))
    s.db.prepare("UPDATE catalogs SET status = 'draft' WHERE id = ?").run(s.chairDraft)
    assert.equal(getVisibleCatalog(s.db, s.vendorA, s.chairDraft), undefined)
  })

  it('search and the category filter never widen the result set', () => {
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorA, { search: 'furniture' })), ['Ergo Chair'])
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorB, { search: 'Desk' }), [])
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorB, { search: '%' }), [])
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorB, { categoryId: s.desks }), [])
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorA, { categoryId: s.lamps }), [])
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorA, { categoryId: s.desks })), ['Standing Desk'])
  })

  it('changing assignments changes visibility immediately', () => {
    s.db.prepare('DELETE FROM vendor_company_categories WHERE company_id = ? AND category_id = ?').run(s.vendorB, s.chairs)
    assert.equal(getVisibleCatalog(s.db, s.vendorB, s.chair1), undefined)
    assert.ok(getVisibleCatalog(s.db, s.vendorA, s.chair1))
    s.assign(s.vendorB, s.lamps)
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorB)), ['Desk Lamp'])
  })

  it('an inactive category hides its listings and drops out of the category list', () => {
    s.db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(s.chairs)
    assert.deepEqual(titles(listVisibleCatalogs(s.db, s.vendorA)), ['Standing Desk'])
    assert.deepEqual(
      listVisibleCategories(s.db, s.vendorA).map((c) => c.name),
      ['Desks'],
    )
  })

  it('a suspended company sees nothing; others are unaffected', () => {
    s.db.prepare("UPDATE vendor_companies SET status = 'suspended' WHERE id = ?").run(s.vendorA)
    assert.deepEqual(listVisibleCatalogs(s.db, s.vendorA), [])
    assert.deepEqual(listVisibleCategories(s.db, s.vendorA), [])
    assert.ok(getVisibleCatalog(s.db, s.vendorB, s.chair1))
  })

  it('legacy per-catalog assignments grant nothing', () => {
    s.db.prepare('INSERT INTO catalog_assignments (catalog_id, company_id) VALUES (?, ?)').run(s.lamp1, s.vendorC)
    assert.equal(getVisibleCatalog(s.db, s.vendorC, s.lamp1), undefined)
  })

  it('assignments are unique per company/category pair', () => {
    assert.throws(() => s.assign(s.vendorA, s.chairs))
  })
})
