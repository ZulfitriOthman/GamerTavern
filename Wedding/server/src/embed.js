// Entry point for running the wedding API INSIDE another Express server — the
// shared GamerTavern Backend (backend.nanashicollectibles.com):
//
//   const { createWeddingModule } = await import('../Wedding/server/src/embed.js')
//   const wedding = await createWeddingModule()
//   app.use(wedding.prefix, wedding.router)          // → /api/wedding/*
//
// The module uses only Wedding/server/.env (parsed privately, see config.js),
// its own MySQL pool and its own upload directory. It never creates tables.
import { createWeddingRouter, WEDDING_API_PREFIX } from './app.js'
import { config } from './config.js'
import { checkSchema, createPool } from './db.js'
import { ensureUploadDir, sweepTemp } from './lib/storage.js'
import { cleanup } from './services/rateLimit.js'

export async function createWeddingModule({ handleCors = false } = {}) {
  const db = createPool()
  await ensureUploadDir()
  await checkSchema(db) // warns only

  const timer = setInterval(() => {
    cleanup(db).catch((e) => console.error('[wedding-api] cleanup failed', e.code || e.message))
    sweepTemp().catch(() => {})
  }, 60 * 60 * 1000)
  timer.unref()

  console.log(`[wedding-api] mounted at ${WEDDING_API_PREFIX} (uploads → ${config.uploads.dir})`)
  return {
    prefix: WEDDING_API_PREFIX,
    router: createWeddingRouter({ db, handleCors }),
    /** Origins the wedding frontend is served from (for the host's CORS allowlist). */
    allowedOrigins: config.allowedOrigins,
    async close() {
      clearInterval(timer)
      await db.end()
    },
  }
}
