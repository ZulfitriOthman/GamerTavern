// MySQL pool — same approach as Backend/modules/db.module.js (mysql2/promise,
// timezone "Z"), plus: UTC session time zone, utf8mb4, DATE columns as plain
// 'YYYY-MM-DD' strings and TINYINT(1) as booleans. Never creates tables.
import mysql from 'mysql2/promise'
import { config } from './config.js'

export function createPool(overrides = {}) {
  const { configured: _configured, ...mysqlConfig } = config.mysql
  if (!config.mysql.configured && !overrides.user) return unconfiguredPool()
  const pool = mysql.createPool({
    ...mysqlConfig,
    ...overrides,
    waitForConnections: true,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: ['DATE'],
    multipleStatements: false,
    enableKeepAlive: true,
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        const v = field.string()
        return v === null ? null : v === '1'
      }
      return next()
    },
  })
  // CURRENT_TIMESTAMP defaults are written in UTC regardless of server settings.
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"))
  return pool
}

/** Stand-in used when MYSQL_USER / MYSQL_DATABASE are not set: every query fails with a clear error. */
function unconfiguredPool() {
  const fail = () => Promise.reject(Object.assign(new Error('MySQL is not configured'), { code: 'DB_NOT_CONFIGURED' }))
  return { query: fail, getConnection: fail, end: () => Promise.resolve(), pool: null, notConfigured: true }
}

/** Runs fn(conn) inside a transaction; commits on success, rolls back on error. */
export async function withTransaction(db, fn) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback().catch(() => {})
    throw error
  } finally {
    conn.release()
  }
}

const REQUIRED_MIGRATION = '011'

/** Startup check: confirms connectivity and that the SQL scripts have been run. */
export async function checkSchema(db) {
  if (db.notConfigured) {
    console.warn('[wedding-api] MySQL is not configured (MYSQL_USER / MYSQL_DATABASE missing). Copy server/.env.example to server/.env and fill it in. The API will answer 503 until then.')
    return false
  }
  try {
    const [rows] = await db.query('SELECT MAX(version) AS v FROM wedding_schema_migrations')
    if (!rows[0]?.v || rows[0].v < REQUIRED_MIGRATION) {
      console.warn(`[wedding-api] Database is at migration ${rows[0]?.v ?? 'none'}; expected ${REQUIRED_MIGRATION}. Run the scripts in Wedding/database/migrations.`)
      return false
    }
    return true
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[wedding-api] Wedding tables not found. Run the scripts in Wedding/database/migrations (see Wedding/database/README.md).')
    } else {
      console.error(`[wedding-api] Cannot reach MySQL at ${config.mysql.host}:${config.mysql.port} (${error.code || error.message}). The API will answer 503 until it is reachable.`)
    }
    return false
  }
}
