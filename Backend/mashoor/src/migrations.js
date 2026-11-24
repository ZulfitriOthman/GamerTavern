// Ordered MySQL / MariaDB schema migrations, kept as SQL files in
// Database/mashoor/mysql/migrations (NNNN_description.sql, contiguous from
// 0001). Each file records itself in mashoor_schema_migrations. Append new
// files; never edit one that has shipped.
//
// The Backend NEVER applies migrations by itself: at startup it only checks
// the recorded version (checkSchema) and refuses to start Mashoor when the
// database is behind or ahead. Pending files are applied deliberately — in
// MySQL Workbench, or with `npm run mashoor:migrate` (applyMigrations).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Backend/mashoor/src → GamerTavern/Database/mashoor/mysql/migrations
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../Database/mashoor/mysql/migrations', import.meta.url))

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/

let cached
export function loadMigrations(dir = process.env.MASHOOR_MIGRATIONS_DIR || DEFAULT_MIGRATIONS_DIR) {
  if (cached?.dir === dir) return cached.migrations
  let names
  try {
    names = readdirSync(dir)
  } catch (error) {
    throw new Error(`Mashoor migrations folder not readable: ${dir} (${error.code ?? error.message})`)
  }
  const files = names.filter((name) => FILE_PATTERN.test(name)).sort()
  if (files.length === 0) throw new Error(`No Mashoor migrations found in ${dir}`)
  const migrations = files.map((name, index) => {
    const version = Number(name.match(FILE_PATTERN)[1])
    if (version !== index + 1) {
      throw new Error(`Mashoor migrations must be numbered contiguously from 0001; found ${name} at position ${index + 1}`)
    }
    return { version, name: name.replace(/\.sql$/, ''), sql: readFileSync(join(dir, name), 'utf8') }
  })
  cached = { dir, migrations }
  return migrations
}

/**
 * Splits a migration file into statements the way the mysql client does:
 * `;` ends a statement unless a `DELIMITER x` line changed it (trigger bodies).
 * Comment-only lines are dropped; quoted `;` inside strings are respected.
 */
export function splitStatements(sql) {
  const statements = []
  let delimiter = ';'
  let current = ''
  for (const line of sql.split(/\r?\n/)) {
    const directive = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i)
    if (directive) {
      delimiter = directive[1]
      continue
    }
    if (!current.trim() && /^\s*(--|#)/.test(line)) continue
    current += line + '\n'
    // Cut every complete statement on this line (outside quotes).
    for (;;) {
      const end = findDelimiter(current, delimiter)
      if (end < 0) break
      const statement = current.slice(0, end).trim()
      if (statement) statements.push(statement)
      current = current.slice(end + delimiter.length)
    }
  }
  if (current.trim() && !/^\s*(--[^\n]*\n?\s*)*$/.test(current)) statements.push(current.trim())
  return statements
}

function findDelimiter(text, delimiter) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '-' && text[i + 1] === '-' && /\s/.test(text[i + 2] ?? ' ')) {
      const nl = text.indexOf('\n', i)
      if (nl < 0) return -1
      i = nl
    } else if (text.startsWith(delimiter, i)) return i
  }
  return -1
}

/** Highest version recorded in mashoor_schema_migrations; 0 when the table is missing. */
export async function schemaVersion(db) {
  try {
    const row = await db.prepare('SELECT MAX(version) AS v FROM mashoor_schema_migrations').get()
    return Number(row?.v ?? 0)
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return 0
    throw error
  }
}

/**
 * Startup check (read-only). Throws a clear error when the database is not
 * exactly at the version of the bundled migration files.
 */
export async function checkSchema(db, migrations = loadMigrations()) {
  const current = await schemaVersion(db)
  const latest = migrations.length
  if (current === latest) return current
  if (current > latest) {
    throw new Error(`Mashoor database is at version ${current}, newer than the ${latest} migration file(s) available`)
  }
  const pending = migrations.slice(current).map((m) => m.name)
  throw new Error(
    `Mashoor database schema is at version ${current}; ${latest} is required. Apply ${pending.join(', ')} from Database/mashoor/mysql/migrations ` +
      '(MySQL Workbench, or `npm run mashoor:migrate`).',
  )
}

/**
 * Applies the pending migration files in order (scripts and tests only).
 * `from` (a version number) starts there regardless of the recorded version —
 * for a database built by hand without mashoor_schema_migrations, whose tables
 * already match the earlier files (e.g. from: 8 applies only 0008).
 */
export async function applyMigrations(db, migrations = loadMigrations(), { log = () => {}, from } = {}) {
  const current = await schemaVersion(db)
  if (current > migrations.length) {
    throw new Error(`Mashoor database is at version ${current}, newer than the ${migrations.length} migration file(s) available`)
  }
  if (from !== undefined && !(Number.isInteger(from) && from >= 1 && from <= migrations.length)) {
    throw new Error(`--from must be a migration version between 1 and ${migrations.length}`)
  }
  const start = from !== undefined ? Math.max(from - 1, current) : current
  const applied = []
  for (const migration of migrations.slice(start)) {
    // DDL commits implicitly in MySQL, so a migration is not one transaction;
    // each file is written to be safe to re-run (IF NOT EXISTS / INSERT IGNORE)
    // or is the first one the database lacks.
    for (const statement of splitStatements(migration.sql)) await db.exec(statement)
    applied.push(migration.name)
    log(`[mashoor-api] applied migration ${migration.name}`)
  }
  return applied
}
