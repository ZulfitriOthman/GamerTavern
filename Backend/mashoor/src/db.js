// Mashoor database access: MySQL / MariaDB through mysql2 (the driver and pool
// settings the Backend already uses in modules/db.module.js). Tables are
// prefixed mashoor_ (Database/mashoor/mysql).
//
// The handle keeps the statement shape the module was written with, but async:
//   await db.prepare(sql).get(...params)   → first row or undefined
//   await db.prepare(sql).all(...params)   → rows
//   await db.prepare(sql).run(...params)   → { lastInsertRowid, changes }
//   await transaction(db, async () => { ... })
// Inside transaction() every db.* call made in that async flow runs on the
// transaction's own connection (AsyncLocalStorage), so helpers need no extra
// parameter and nothing inside a transaction can run on another connection.
//
// Values come back as the API always returned them: DATETIME columns as UTC
// 'YYYY-MM-DD HH:MM:SS' strings (dateStrings + session time_zone '+00:00', the
// same text SQLite's CURRENT_TIMESTAMP gave), TINYINT flags as 0/1 numbers.
import { AsyncLocalStorage } from 'node:async_hooks'
import mysql from 'mysql2/promise'
import { describeDatabase } from './config.js'
import { checkSchema } from './migrations.js'
import { runChecklistImport } from './checklist/seed.js'

const UTC = "SET time_zone = '+00:00'"

/**
 * Opens a pool and verifies it: the server answers, the schema is at the
 * version of the bundled migrations. Throws (never falls back) otherwise.
 * `importChecklists` writes the bundled checklist templates when missing.
 */
export async function openDatabase(mysqlConfig, { importChecklists = true, checkMigrations = true, log = true } = {}) {
  for (const key of ['user', 'database']) {
    if (!mysqlConfig?.[key]) throw new Error(`Mashoor database is not configured: set MASHOOR_MYSQL_${key.toUpperCase()} (or MYSQL_${key.toUpperCase()}) in the Backend environment`)
  }
  const pool = mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: mysqlConfig.connectionLimit ?? 5,
    queueLimit: 0,
    connectTimeout: mysqlConfig.connectTimeout ?? 15000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    multipleStatements: false,
    // A request value that is an object is bound as a string, never expanded
    // into `col` = val SQL.
    stringifyObjects: true,
  })
  // Every pooled connection works in UTC, like the rest of the module.
  pool.pool.on('connection', (connection) => connection.query(UTC))
  pool.on?.('error', (error) => console.error('[mashoor-api] database pool error:', error?.code || error?.message))

  const db = createHandle(pool, mysqlConfig)
  try {
    const info = await db.prepare('SELECT DATABASE() AS db, VERSION() AS version').get()
    db.info = { database: info.db, version: info.version, where: describeDatabase(mysqlConfig) }
    if (checkMigrations) await checkSchema(db)
    if (importChecklists) {
      const report = await runChecklistImport(db)
      if (log && !report.skipped) {
        for (const name of report.upgraded) console.log(`[mashoor-api] checklist template upgraded to versioned form: ${name}`)
        for (const name of report.created) console.log(`[mashoor-api] checklist template imported: ${name}`)
        for (const name of report.notApplied) {
          console.log(`[mashoor-api] checklist template “${name}” already exists; the bundled transcription differs and was NOT applied`)
        }
      }
    }
  } catch (error) {
    await pool.end().catch(() => {})
    const reason = error.code ? `${error.code}: ${error.message}` : error.message
    throw new Error(`Mashoor database ${describeDatabase(mysqlConfig)} unavailable — ${reason}`, { cause: error })
  }
  return db
}

function createHandle(pool, mysqlConfig) {
  const tx = new AsyncLocalStorage()
  const runner = () => tx.getStore() ?? pool

  async function query(sql, params) {
    const [result] = await runner().query(sql, params)
    return result
  }

  return {
    pool,
    config: mysqlConfig,
    prepare(sql) {
      return {
        get: async (...params) => (await query(sql, params))[0],
        all: async (...params) => query(sql, params),
        run: async (...params) => {
          const result = await query(sql, params)
          return { lastInsertRowid: result.insertId, changes: result.affectedRows }
        },
      }
    },
    /** One statement without parameters (DDL, migrations). */
    exec: (sql) => query(sql, []),
    async transaction(fn) {
      if (tx.getStore()) return fn() // nested: join the outer transaction
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        const result = await tx.run(connection, fn)
        await connection.commit()
        return result
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      } finally {
        connection.release()
      }
    },
    close: () => pool.end(),
  }
}

/** Runs fn in one database transaction: committed when it resolves, rolled back when it throws. */
export function transaction(db, fn) {
  return db.transaction(fn)
}

/** MySQL duplicate-key error (a UNIQUE index or primary key). */
export const isDuplicate = (error) => error?.code === 'ER_DUP_ENTRY'

export async function audit(db, { actorType, actorId, action, targetType = null, targetId = null, metadata = null }) {
  await db
    .prepare(
      `INSERT INTO mashoor_audit_log (actor_type, actor_id, action, target_type, target_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(actorType, actorId ?? null, action, targetType, targetId, metadata ? JSON.stringify(metadata) : null)
}
