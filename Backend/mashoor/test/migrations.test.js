// The SQL files in Database/mashoor/migrations upgrade an existing database in
// place without touching its data.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { openDatabase } from '../src/db.js'
import { loadMigrations } from '../src/migrations.js'

describe('migrations', () => {
  it('loads contiguous numbered files from Database/mashoor/migrations', () => {
    const migrations = loadMigrations()
    assert.ok(migrations.length >= 2)
    migrations.forEach((m, i) => assert.equal(m.version, i + 1))
    assert.match(migrations[0].name, /^0001_/)
  })

  it('upgrades a version-1 database and keeps its rows', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'mashoor-mig-')), 'v1.db')
    const all = loadMigrations()
    const v1 = openDatabase(path, { migrations: all.slice(0, 1) })
    v1.prepare("INSERT INTO staff_users (email, name, password_hash) VALUES ('s@x.test', 'S', 'h')").run()
    v1.prepare("INSERT INTO vendor_companies (name) VALUES ('Old Co')").run()
    v1.prepare("INSERT INTO vendor_users (company_id, email, name, password_hash) VALUES (1, 'v@x.test', 'V', 'h')").run()
    v1.prepare("INSERT INTO catalogs (title, status) VALUES ('Old catalog', 'published')").run()
    assert.equal(v1.prepare('PRAGMA user_version').get().user_version, 1)
    v1.close()

    const db = openDatabase(path)
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, all.length)
    assert.equal(db.prepare('SELECT email FROM staff_users').get().email, 's@x.test')
    const vendor = db.prepare('SELECT * FROM vendor_users').get()
    assert.equal(vendor.must_change_password, 0, 'existing accounts are not forced to change password')
    // 0003: same row and id, email kept (now optional), no username invented.
    assert.equal(vendor.id, 1)
    assert.equal(vendor.email, 'v@x.test')
    assert.equal(vendor.password_hash, 'h')
    assert.equal(vendor.username, null)
    db.prepare("INSERT INTO vendor_users (company_id, username, name, password_hash) VALUES (1, 'nomail', 'N', 'h')").run()
    assert.throws(() => db.prepare("INSERT INTO vendor_users (company_id, username, name, password_hash) VALUES (1, 'NoMail', 'N', 'h')").run())
    assert.throws(() => db.prepare("INSERT INTO vendor_users (company_id, username, name, password_hash) VALUES (1, 'nomail', 'N', 'h')").run())
    const catalog = db.prepare('SELECT * FROM catalogs').get()
    assert.equal(catalog.title, 'Old catalog')
    assert.equal(catalog.category_id, null)
    assert.equal(catalog.currency, 'MYR')
    db.close()
  })

  it('0004 clears must-change flags and nothing else', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'mashoor-mig-')), 'v3.db')
    const all = loadMigrations()
    const v3 = openDatabase(path, { migrations: all.slice(0, 3) })
    v3.prepare("INSERT INTO vendor_companies (name) VALUES ('Co')").run()
    v3.prepare(
      "INSERT INTO vendor_users (company_id, username, name, password_hash, must_change_password, active) VALUES (1, 'flagged', 'F', 'h1', 1, 1), (1, 'inactive', 'I', 'h2', 1, 0)",
    ).run()
    v3.prepare("INSERT INTO categories (name, name_key) VALUES ('C', 'c')").run()
    v3.prepare('INSERT INTO vendor_company_categories (company_id, category_id) VALUES (1, 1)').run()
    const before = v3.prepare('SELECT id, username, password_hash, active FROM vendor_users ORDER BY id').all()
    v3.close()

    const db = openDatabase(path)
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, all.length)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vendor_users WHERE must_change_password = 1').get().n, 0)
    assert.deepEqual(db.prepare('SELECT id, username, password_hash, active FROM vendor_users ORDER BY id').all(), before)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vendor_company_categories').get().n, 1)
    db.close()
  })

  it('refuses a database newer than the available files', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'mashoor-mig-')), 'future.db')
    openDatabase(path).close()
    assert.throws(() => openDatabase(path, { migrations: loadMigrations().slice(0, 1) }), /newer than/)
  })
})
