import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { loadMigrations } from './migrations.js'
import { runChecklistImport } from './checklist/seed.js'

export function openDatabase(path, { migrations = loadMigrations(), importChecklists = true } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  const log = path !== ':memory:'
  try {
    migrate(db, migrations, { log })
    // Repeatable: imports the client's checklist templates once (see checklist/seed.js).
    if (importChecklists) {
      const report = runChecklistImport(db)
      if (log && !report.skipped) {
        for (const name of report.upgraded) console.log(`[mashoor-api] checklist template upgraded to versioned form: ${name}`)
        for (const name of report.created) console.log(`[mashoor-api] checklist template imported: ${name}`)
        for (const name of report.notApplied) {
          console.log(`[mashoor-api] checklist template “${name}” already exists; the bundled transcription differs and was NOT applied`)
        }
      }
    }
  } catch (error) {
    db.close()
    throw error
  }
  return db
}

function migrate(db, migrations, { log }) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get()
  if (current > migrations.length) {
    throw new Error(`Mashoor database is at version ${current}, newer than the ${migrations.length} migration file(s) available`)
  }
  for (const { version, name, sql } of migrations.slice(current)) {
    transaction(db, () => {
      db.exec(sql)
      db.exec(`PRAGMA user_version = ${version}`)
    })
    if (log) console.log(`[mashoor-api] applied migration ${name}`)
  }
}

export function transaction(db, fn) {
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

export function audit(db, { actorType, actorId, action, targetType = null, targetId = null, metadata = null }) {
  db.prepare(
    `INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(actorType, actorId ?? null, action, targetType, targetId, metadata ? JSON.stringify(metadata) : null)
}
