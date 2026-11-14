// The single source of truth for what a vendor company may see.
//
// Every portal catalog route (list, search, detail, image) must go through
// these functions with the companyId taken from the authenticated session
// (req.vendor.companyId) — never from the request. A listing is visible only
// when ALL hold:
//   1. it is published (draft = unpublished, archived: never visible),
//   2. it has a category and that category is active,
//   3. that category is assigned to the company (vendor_company_categories),
//   4. the company is active.
// A category filter from the client only ever NARROWS this set.
// Callers answer 404 for anything not returned here, so a vendor cannot
// distinguish "not assigned" from "does not exist".
// (catalog_assignments from migration 0001 is superseded and grants nothing.)

const VISIBLE_FROM = `
  FROM catalogs cat
  JOIN categories cg ON cg.id = cat.category_id AND cg.active = 1
  JOIN vendor_company_categories vcc ON vcc.category_id = cat.category_id AND vcc.company_id = ?
  JOIN vendor_companies vc ON vc.id = vcc.company_id AND vc.status = 'active'
  WHERE cat.status = 'published'`

const COLUMNS = `cat.id, cat.title, cat.description, cat.published_at, cat.updated_at, cat.price_cents, cat.currency,
  cat.image_file, cat.image_type, cat.category_id, cg.name AS category_name`

function filters({ search, categoryId } = {}) {
  let sql = ''
  const params = []
  const term = typeof search === 'string' ? search.trim() : ''
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
    sql += ` AND (cat.title LIKE ? ESCAPE '\\' OR cat.description LIKE ? ESCAPE '\\')`
    params.push(pattern, pattern)
  }
  if (categoryId != null) {
    sql += ' AND cat.category_id = ?'
    params.push(categoryId)
  }
  return { sql, params }
}

export function listVisibleCatalogs(db, companyId, { search, categoryId, limit = -1, offset = 0 } = {}) {
  const f = filters({ search, categoryId })
  return db
    .prepare(`SELECT ${COLUMNS} ${VISIBLE_FROM} ${f.sql} ORDER BY cat.published_at DESC, cat.id DESC LIMIT ? OFFSET ?`)
    .all(companyId, ...f.params, limit, offset)
}

export function countVisibleCatalogs(db, companyId, { search, categoryId } = {}) {
  const f = filters({ search, categoryId })
  return db.prepare(`SELECT COUNT(*) AS n ${VISIBLE_FROM} ${f.sql}`).get(companyId, ...f.params).n
}

export function getVisibleCatalog(db, companyId, catalogId) {
  return db.prepare(`SELECT ${COLUMNS} ${VISIBLE_FROM} AND cat.id = ?`).get(companyId, catalogId)
}

// Categories the company can browse (assigned, active, company active), with
// how many listings in each it can currently see.
export function listVisibleCategories(db, companyId) {
  return db
    .prepare(
      `SELECT cg.id, cg.name, cg.description,
              (SELECT COUNT(*) FROM catalogs cat WHERE cat.category_id = cg.id AND cat.status = 'published') AS listing_count
         FROM vendor_company_categories vcc
         JOIN categories cg ON cg.id = vcc.category_id AND cg.active = 1
         JOIN vendor_companies vc ON vc.id = vcc.company_id AND vc.status = 'active'
        WHERE vcc.company_id = ?
        ORDER BY cg.name COLLATE NOCASE`,
    )
    .all(companyId)
}
