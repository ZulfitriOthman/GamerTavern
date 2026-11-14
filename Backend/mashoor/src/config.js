import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Public path prefix of the Mashoor API inside the shared Backend. */
export const MASHOOR_API_PREFIX = '/api/mashoor'

// Backend/mashoor
const moduleRoot = fileURLToPath(new URL('..', import.meta.url))

// Every setting is namespaced MASHOOR_* because this module shares process.env
// with the rest of the Backend (PORT, DB settings, origins, ... belong to it).
export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production'
  return {
    production,
    dbPath: env.MASHOOR_DB_PATH || join(moduleRoot, 'data', 'mashoor.db'),
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
