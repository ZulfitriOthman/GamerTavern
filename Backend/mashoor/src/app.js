import express from 'express'
import { originCheck } from './auth/middleware.js'
import { createLoginLimiter } from './auth/loginLimiter.js'
import { MASHOOR_API_PREFIX } from './config.js'
import { createImageStore } from './images.js'
import { createDiagramStore } from './checklist/diagrams.js'
import { adminRouter } from './routes/admin.js'
import { portalRouter } from './routes/portal.js'

/**
 * All Mashoor endpoints as one self-contained router, mounted at
 * MASHOOR_API_PREFIX (/api/mashoor):
 *   /health  /admin/*  (staff)  /portal/*  (vendors)
 * It carries its own JSON parsing, headers, CSRF origin check, 404 and error
 * handler, so it neither relies on nor interferes with the host Backend's
 * middleware.
 */
export function createMashoorRouter({ db, config, limiter = createLoginLimiter() }) {
  const router = express.Router()
  const images = createImageStore(config.storageDir)
  const diagrams = createDiagramStore(config.storageDir)

  router.use(express.json({ limit: '100kb' }))
  router.use((req, res, next) => {
    res.removeHeader('X-Powered-By')
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    next()
  })
  router.use(originCheck(config.allowedOrigins))

  router.get('/health', (req, res) => res.json({ ok: true }))
  router.use('/admin', adminRouter({ db, config, limiter, images, diagrams }))
  router.use('/portal', portalRouter({ db, config, limiter, images, diagrams }))
  // Unknown Mashoor paths: JSON 404 from here, never the host app's HTML page.
  router.use((req, res) => res.status(404).json({ error: 'Not found.' }))

  // eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
  router.use((err, req, res, next) => {
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.expose ? err.message : 'Bad request.' })
    }
    console.error('[mashoor-api]', err)
    res.status(500).json({ error: 'Something went wrong.' })
  })

  return router
}

/** Minimal standalone app (used by the tests); production runs inside the Backend via embed.js. */
export function createApp({ db, config, limiter }) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(MASHOOR_API_PREFIX, createMashoorRouter({ db, config, limiter }))
  return app
}
