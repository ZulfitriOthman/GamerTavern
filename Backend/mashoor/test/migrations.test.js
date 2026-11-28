// The MySQL migration files in Database/mashoor/mysql/migrations: loading,
// statement splitting (DELIMITER trigger bodies), a fresh build, the startup
// version check, and 0008 on a database built by hand without the migration
// ledger and triggers (the shape found on nanashi_collectibles).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyMigrations, checkSchema, loadMigrations, schemaVersion, splitStatements } from '../src/migrations.js'
import { createTestDatabase } from './helpers.js'

const TRIGGERS = [
  'mashoor_inspection_events_no_delete',
  'mashoor_inspection_events_no_update',
  'mashoor_inspection_revisions_frozen',
  'mashoor_inspection_revisions_no_delete',
  'mashoor_inspection_signoffs_no_delete',
  'mashoor_inspection_signoffs_no_update',
  'mashoor_template_versions_frozen',
  'mashoor_template_versions_no_delete_published',
]
const triggersOf = async (db) =>
  (await db.prepare('SELECT TRIGGER_NAME AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() ORDER BY 1').all()).map((r) => r.n)

describe('MySQL migrations', () => {
  it('loads contiguous numbered files from Database/mashoor/mysql/migrations', () => {
    const migrations = loadMigrations()
    assert.ok(migrations.length >= 8)
    migrations.forEach((m, i) => assert.equal(m.version, i + 1))
    assert.match(migrations[0].name, /^0001_/)
    assert.equal(migrations[7].name, '0008_schema_migrations_and_history_triggers')
  })

  it('splits statements like the mysql client, including DELIMITER trigger bodies', () => {
    const sql = loadMigrations()[7].sql
    const statements = splitStatements(sql)
    assert.equal(statements.filter((s) => /^CREATE TRIGGER/.test(s)).length, 8)
    assert.ok(statements.every((s) => !/^DELIMITER/m.test(s)))
    assert.ok(statements.find((s) => s.includes('mashoor_inspection_revisions_frozen')).endsWith('END'))
    assert.deepEqual(splitStatements("SELECT 'a;b';\n-- c;\nSELECT 2;"), ["SELECT 'a;b'", 'SELECT 2'])
  })

  it('builds a fresh database to the latest version with every trigger', async () => {
    const testDb = await createTestDatabase()
    const db = await testDb.open({ importChecklists: false })
    try {
      assert.equal(await schemaVersion(db), loadMigrations().length)
      assert.equal(await checkSchema(db), loadMigrations().length)
      assert.deepEqual(await triggersOf(db), TRIGGERS)
    } finally {
      await db.close()
      await testDb.drop()
    }
  })

  it('0008 restores the ledger and triggers on a hand-built schema and keeps its rows', async () => {
    // Exercised as the latest file it was written as (later files are covered below).
    const all = loadMigrations().slice(0, 8)
    const testDb = await createTestDatabase({ migrations: all.slice(0, 7) })
    const db = await testDb.open({ checkMigrations: false, importChecklists: false })
    try {
      // Reproduce the Workbench-built shape: tables, checks and keys of 0001–0007,
      // but no mashoor_schema_migrations and no triggers.
      for (const name of await triggersOf(db)) await db.exec(`DROP TRIGGER ${name}`)
      await db.exec('DROP TABLE mashoor_schema_migrations')
      await db.prepare("INSERT INTO mashoor_vendor_companies (name) VALUES ('Existing Co')").run()
      assert.equal(await schemaVersion(db), 0)
      await assert.rejects(checkSchema(db, all), /schema is at version 0; 8 is required/)

      assert.deepEqual(await applyMigrations(db, all, { from: 8 }), ['0008_schema_migrations_and_history_triggers'])
      assert.equal(await schemaVersion(db), 8)
      assert.deepEqual((await db.prepare('SELECT version FROM mashoor_schema_migrations ORDER BY version').all()).map((r) => r.version), [1, 2, 3, 4, 5, 6, 7, 8])
      assert.deepEqual(await triggersOf(db), TRIGGERS)
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM mashoor_vendor_companies WHERE name = 'Existing Co'").get()).n, 1)
      // Once recorded, asking again applies nothing; the file itself is idempotent too.
      assert.deepEqual(await applyMigrations(db, all, { from: 8 }), [])
      await db.exec('DELETE FROM mashoor_schema_migrations WHERE version = 8')
      assert.deepEqual(await applyMigrations(db, all, { from: 8 }), ['0008_schema_migrations_and_history_triggers'])
      assert.deepEqual(await triggersOf(db), TRIGGERS)
      assert.equal(await checkSchema(db, all), 8)
    } finally {
      await db.close()
      await testDb.drop()
    }
  })

  it('0009 adds organisation removal and keeps existing organisations as they were', async () => {
    const all = loadMigrations()
    assert.equal(all[8].name, '0009_vendor_company_removal')
    const testDb = await createTestDatabase({ migrations: all.slice(0, 8) })
    const db = await testDb.open({ checkMigrations: false, importChecklists: false })
    try {
      await db.prepare("INSERT INTO mashoor_vendor_companies (name, status) VALUES ('Kept Active', 'active'), ('Kept Suspended', 'suspended')").run()
      await assert.rejects(db.prepare("UPDATE mashoor_vendor_companies SET status = 'removed'").run(), /CONSTRAINT|check/i)
      assert.deepEqual(await applyMigrations(db, all), ['0009_vendor_company_removal'])
      assert.equal(await checkSchema(db), all.length)
      const rows = await db.prepare('SELECT name, status, removed_at, removed_by FROM mashoor_vendor_companies ORDER BY name').all()
      assert.deepEqual(rows, [
        { name: 'Kept Active', status: 'active', removed_at: null, removed_by: null },
        { name: 'Kept Suspended', status: 'suspended', removed_at: null, removed_by: null },
      ])
      // removed requires who and when, and only removed may carry them.
      await assert.rejects(db.prepare("UPDATE mashoor_vendor_companies SET status = 'removed' WHERE name = 'Kept Active'").run(), /CONSTRAINT|check/i)
      await db.prepare("INSERT INTO mashoor_staff_users (email, name, password_hash) VALUES ('s@x.test', 'S', 'x')").run()
      const staffId = (await db.prepare('SELECT id FROM mashoor_staff_users').get()).id
      await assert.rejects(
        db.prepare("UPDATE mashoor_vendor_companies SET removed_at = CURRENT_TIMESTAMP, removed_by = ? WHERE name = 'Kept Active'").run(staffId),
        /CONSTRAINT|check/i,
      )
      await db
        .prepare("UPDATE mashoor_vendor_companies SET status = 'removed', removed_at = CURRENT_TIMESTAMP, removed_by = ? WHERE name = 'Kept Active'")
        .run(staffId)
      await assert.rejects(db.prepare("UPDATE mashoor_vendor_companies SET removed_by = 999999 WHERE name = 'Kept Active'").run(), /foreign key/i)
    } finally {
      await db.close()
      await testDb.drop()
    }
  })

  it('the startup check refuses a database newer than the bundled files', async () => {
    const testDb = await createTestDatabase()
    const db = await testDb.open({ importChecklists: false })
    try {
      const latest = loadMigrations().length
      await assert.rejects(checkSchema(db, loadMigrations().slice(0, 7)), new RegExp(`version ${latest}, newer than the 7 migration file`))
    } finally {
      await db.close()
      await testDb.drop()
    }
  })
})
