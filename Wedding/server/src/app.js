import cookieParser from 'cookie-parser'
import express from 'express'
import { config } from './config.js'
import { errorHandler, notFound } from './lib/errors.js'
import { cors, noStore, securityHeaders } from './middleware/security.js'
import createAdminRoutes from './routes/admin.routes.js'
import createAuthRoutes from './routes/auth.routes.js'
import createMediaRoutes from './routes/media.routes.js'
import createPublicRoutes from './routes/public.routes.js'
import { hasMediaColumns } from './services/photos.js'

/** Public path prefix of the wedding API, both standalone and inside the shared Backend. */
export const WEDDING_API_PREFIX = '/api/wedding'

/**
 * All wedding endpoints as one self-contained router:
 *   /health  /public/*  /auth/*  /admin/*  /media/*
 * It carries its own security headers, cookie parsing, JSON parsing and error
 * handler, so it can be mounted into another Express app (the GamerTavern
 * Backend) without relying on, or interfering with, that app's middleware.
 *
 * handleCors: true when running standalone. When embedded, the host app's CORS
 * middleware (which already answers preflights) is used instead.
 */
export function createWeddingRouter({ db, handleCors = true }) {
  const router = express.Router()
  router.use(securityHeaders)
  if (handleCors) router.use(cors)
  router.use(cookieParser())
  // JSON only (no urlencoded): plain cross-site HTML forms cannot reach the API.
  // (A no-op if the host app already parsed the body.)
  router.use(express.json({ limit: '300kb', type: 'application/json' }))

  // Reports whether the API, MySQL and the wedding tables are ready (no secrets).
  //   database: connected | not-configured | unreachable
  //   schema:   ready (tables exist) | missing (run database/migrations)
  //   data:     ready (settings + events seeded) | missing (run database/seeds) | unknown
  //   mediaTypes: true once migration 010 (GIF/video columns) has been run
  //   migrationsRecorded: false when wedding_schema_migrations is empty — e.g. the
  //   scripts ran with Workbench auto-commit OFF, so their INSERTs were rolled back.
  router.get('/health', async (_req, res) => {
    const out = { database: 'connected', schema: 'ready', data: 'unknown', mediaTypes: false, migrationsRecorded: false }
    try {
      const [[row]] = await db.query(
        `SELECT (SELECT COUNT(*) FROM wedding_schema_migrations) AS migrations,
                (SELECT COUNT(*) FROM wedding_settings WHERE id = 1) AS settings,
                (SELECT COUNT(*) FROM wedding_events) AS events`,
      )
      out.migrationsRecorded = Number(row.migrations) > 0
      out.data = Number(row.settings) > 0 && Number(row.events) > 0 ? 'ready' : 'missing'
      out.mediaTypes = await hasMediaColumns(db)
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') out.schema = 'missing'
      else {
        out.database = error.code === 'DB_NOT_CONFIGURED' ? 'not-configured' : 'unreachable'
        out.schema = 'unknown'
      }
    }
    const ok = out.database === 'connected' && out.schema === 'ready' && out.data === 'ready'
    res.status(ok ? 200 : 503).json({ success: ok, status: ok ? 'ok' : 'degraded', api: 'running', ...out })
  })
  router.use('/public', noStore, createPublicRoutes({ db }))
  router.use('/auth', noStore, createAuthRoutes({ db }))
  router.use('/admin', noStore, createAdminRoutes({ db }))
  router.use('/media', createMediaRoutes({ db }))

  // Unknown wedding paths: JSON 404 from here, never the host app's HTML page.
  router.use(() => {
    throw notFound()
  })
  router.use(errorHandler)
  return router
}

/** Standalone server (Wedding/server, port 4100). */
export function createApp({ db }) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  const router = createWeddingRouter({ db })
  app.use(WEDDING_API_PREFIX, router)
  // Legacy prefix for builds made before the move to /api/wedding.
  app.use('/api', router)
  app.use(errorHandler)
  return app
}
