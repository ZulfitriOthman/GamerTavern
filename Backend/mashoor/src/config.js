import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Public path prefix of the Mashoor API inside the shared Backend. */
export const MASHOOR_API_PREFIX = '/api/mashoor'

// Backend/mashoor
const moduleRoot = fileURLToPath(new URL('..', import.meta.url))

// Every setting is namespaced MASHOOR_* because this module shares process.env
// with the rest of the Backend (PORT, DB settings, origins, ... belong to it).
//
// Database: MySQL / MariaDB (tables prefixed mashoor_). Each MASHOOR_MYSQL_*
// falls back to the Backend's own MYSQL_* value, so by default Mashoor uses the
// Backend's database; set MASHOOR_MYSQL_* to keep it in a database of its own.
// There is no SQLite fallback: openDatabase() fails clearly when these are
// missing or the server is unreachable.
export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const mysqlSetting = (name) => env[`MASHOOR_MYSQL_${name}`] || env[`MYSQL_${name}`] || ''
  return {
    production,
    mysql: {
      host: mysqlSetting('HOST') || '127.0.0.1',
      port: Number(mysqlSetting('PORT') || 3306),
      user: mysqlSetting('USER'),
      password: mysqlSetting('PASSWORD'),
      database: mysqlSetting('DATABASE'),
      connectionLimit: Number(env.MASHOOR_MYSQL_CONN_LIMIT || 5),
      connectTimeout: Number(env.MASHOOR_MYSQL_CONNECT_TIMEOUT || env.MYSQL_CONNECT_TIMEOUT || 15000),
    },
    // Private file storage (listing images). Never inside Backend/public:
    // files are served only through access-checked API routes.
    storageDir: env.MASHOOR_STORAGE_DIR || join(moduleRoot, 'storage'),
    // Browser origins allowed to make state-changing requests (CSRF guard).
    allowedOrigins: (env.MASHOOR_ALLOWED_ORIGINS || 'http://localhost:5301,http://localhost:5302')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: env.MASHOOR_COOKIE_SECURE ? env.MASHOOR_COOKIE_SECURE === 'true' : production,
    sessionTtlMs: Number(env.MASHOOR_SESSION_TTL_HOURS || 8) * 60 * 60 * 1000,
    // Only used by the standalone test app; when embedded, the Backend's own
    // `trust proxy` setting applies.
    trustProxy: false,
  }
}

/** Where the database is, for logs and reports — never the credentials. */
export const describeDatabase = (mysql) => `mysql://${mysql.host}:${mysql.port}/${mysql.database}`
