// Local development data only. Creates one staff login and three vendor
// companies (one login each), two categories and three listings. Safe to
// re-run: existing records are skipped.
//
//   MASHOOR_SEED_DEV_DATABASE=<database name> npm run mashoor:seed-dev   (from Backend/)
//
// Refuses NODE_ENV=production, and refuses unless MASHOOR_SEED_DEV_DATABASE
// names exactly the configured MySQL database — by default Mashoor uses the
// Backend's own (possibly live) database, so this is a deliberate confirmation.
import { loadConfig } from '../src/config.js'
import { openDatabase } from '../src/db.js'
import { hashPassword } from '../src/auth/passwords.js'

const config = loadConfig()
if (config.production) {
  console.error('Refusing to seed development data when NODE_ENV=production.')
  process.exit(1)
}
if (!process.env.MASHOOR_SEED_DEV_DATABASE || process.env.MASHOOR_SEED_DEV_DATABASE !== config.mysql.database) {
  console.error(`Set MASHOOR_SEED_DEV_DATABASE to the name of the database to fill (configured: ${config.mysql.database || 'none'}) to confirm it.`)
  process.exit(1)
}
const db = await openDatabase(config.mysql)

const DEV_STAFF = { email: 'admin@mashoor.test', name: 'Dev Admin', password: 'AdminPass123!' }
const DEV_VENDORS = [
  { company: 'Vendor A Sdn Bhd', username: 'alice', name: 'Alice (Vendor A)' },
  { company: 'Vendor B Sdn Bhd', username: 'bob', name: 'Bob (Vendor B)' },
  { company: 'Vendor C Sdn Bhd', username: 'carol', name: 'Carol (Vendor C)' },
]
const VENDOR_PASSWORD = 'VendorPass123!'

try {
  if (!(await db.prepare('SELECT 1 FROM mashoor_staff_users WHERE email = ?').get(DEV_STAFF.email))) {
    await db
      .prepare('INSERT INTO mashoor_staff_users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(DEV_STAFF.email, DEV_STAFF.name, await hashPassword(DEV_STAFF.password))
  }

  for (const vendor of DEV_VENDORS) {
    if (await db.prepare('SELECT 1 FROM mashoor_vendor_users WHERE username = ?').get(vendor.username)) continue
    const company = (await db.prepare('SELECT id FROM mashoor_vendor_companies WHERE name = ?').get(vendor.company)) ?? {
      id: Number((await db.prepare('INSERT INTO mashoor_vendor_companies (name) VALUES (?)').run(vendor.company)).lastInsertRowid),
    }
    await db
      .prepare('INSERT INTO mashoor_vendor_users (company_id, username, name, password_hash) VALUES (?, ?, ?, ?)')
      .run(company.id, vendor.username, vendor.name, await hashPassword(VENDOR_PASSWORD))
  }

  // Categories and listings: Vendor A sees Office Chairs, Vendor B sees Desks,
  // Vendor C has no categories (empty catalog).
  const DEV_CATEGORIES = [
    { name: 'Office Chairs', description: 'Task and executive seating', companies: ['Vendor A Sdn Bhd'] },
    { name: 'Desks', description: 'Fixed and standing desks', companies: ['Vendor B Sdn Bhd'] },
  ]
  const DEV_LISTINGS = [
    { title: 'Ergonomic Mesh Chair', category: 'Office Chairs', status: 'published', price: 49900, description: 'Breathable mesh back, adjustable lumbar support.' },
    { title: 'Executive Leather Chair', category: 'Office Chairs', status: 'draft', price: null, description: 'Draft — not visible to vendors.' },
    { title: 'Electric Standing Desk', category: 'Desks', status: 'published', price: 129900, description: 'Dual motor, 70–120 cm height range.' },
  ]
  for (const c of DEV_CATEGORIES) {
    const key = c.name.toLowerCase()
    const category = (await db.prepare('SELECT id FROM mashoor_categories WHERE name_key = ?').get(key)) ?? {
      id: Number((await db.prepare('INSERT INTO mashoor_categories (name, name_key, description) VALUES (?, ?, ?)').run(c.name, key, c.description)).lastInsertRowid),
    }
    for (const companyName of c.companies) {
      const company = await db.prepare('SELECT id FROM mashoor_vendor_companies WHERE name = ?').get(companyName)
      if (company) {
        await db.prepare('INSERT IGNORE INTO mashoor_vendor_company_categories (company_id, category_id) VALUES (?, ?)').run(company.id, category.id)
      }
    }
  }
  for (const l of DEV_LISTINGS) {
    if (await db.prepare('SELECT 1 FROM mashoor_catalogs WHERE title = ?').get(l.title)) continue
    const category = await db.prepare('SELECT id FROM mashoor_categories WHERE name_key = ?').get(l.category.toLowerCase())
    await db
      .prepare(
        `INSERT INTO mashoor_catalogs (title, description, category_id, price_cents, status, published_at)
         VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP END)`,
      )
      .run(l.title, l.description, category.id, l.price, l.status, l.status)
  }

  console.log(`Seeded ${db.info.where}
  Staff  : ${DEV_STAFF.email} / ${DEV_STAFF.password}
  Vendors: ${DEV_VENDORS.map((v) => v.username).join(', ')} / ${VENDOR_PASSWORD}
  Categories: Vendor A → Office Chairs, Vendor B → Desks, Vendor C → none`)
} finally {
  await db.close()
}
