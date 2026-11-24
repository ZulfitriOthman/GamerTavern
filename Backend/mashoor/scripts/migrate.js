// Mashoor schema status / migration for the configured MySQL database.
//   npm run mashoor:migrate            (from Backend/) — status only, changes nothing
//   npm run mashoor:migrate -- --apply — applies the pending files in order
//   npm run mashoor:migrate -- --apply --from 8
//        — for a database created by hand without mashoor_schema_migrations whose
//          tables already match 0001–0007: applies only 0008 onwards
//
// The Backend never migrates by itself; this is the deliberate step (or run
// the same files from Database/mashoor/mysql/migrations in MySQL Workbench).
// Prints the server, database and versions — never the credentials.
import { parseArgs } from 'node:util'
import { loadConfig } from '../src/config.js'
import { openDatabase } from '../src/db.js'
import { applyMigrations, loadMigrations, schemaVersion } from '../src/migrations.js'

const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false }, from: { type: 'string' } } })
const from = values.from === undefined ? undefined : Number(values.from)
const migrations = loadMigrations()
const db = await openDatabase(loadConfig().mysql, { checkMigrations: false, importChecklists: false })
try {
  const current = await schemaVersion(db)
  console.log(`Database ${db.info.where} (${db.info.version}): schema version ${current}, bundled ${migrations.length}.`)
  const pending = migrations.slice(from !== undefined ? Math.max(from - 1, current) : current)
  const tables = (await db.prepare("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'mashoor\\_%'").get()).n
  if (current === 0 && tables > 0 && from === undefined) {
    console.log(`No migration ledger, but ${tables} mashoor_ tables exist (created by hand?). Check they match the migration files, then use -- --apply --from <first missing version>.`)
    process.exitCode = 1
  } else if (!pending.length) console.log('Up to date.')
  else if (!values.apply) console.log(`Pending: ${pending.map((m) => m.name).join(', ')}. Re-run with -- --apply to apply them.`)
  else {
    const applied = await applyMigrations(db, migrations, { log: console.log, from })
    console.log(`Applied ${applied.length}; schema version now ${await schemaVersion(db)}.`)
  }
} finally {
  await db.close()
}
