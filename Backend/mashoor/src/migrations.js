// Ordered schema migrations, kept as SQL files in Database/mashoor/migrations
// (NNNN_description.sql, contiguous from 0001). PRAGMA user_version records
// how many have run. Append new files; never edit one that has shipped.
// SQL is kept close to standard so it ports to PostgreSQL later.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Backend/mashoor/src → GamerTavern/Database/mashoor/migrations
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../Database/mashoor/migrations', import.meta.url))

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
    return { version, name, sql: readFileSync(join(dir, name), 'utf8') }
  })
  cached = { dir, migrations }
  return migrations
}
