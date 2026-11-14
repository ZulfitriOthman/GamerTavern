// Entry point for running the Mashoor API (catalog sharing: staff admin site +
// vendor portal, Listing-Sample/Mashoor) INSIDE the shared GamerTavern Backend:
//
//   const { createMashoorModule } = await import('./mashoor/src/embed.js')
//   const mashoor = await createMashoorModule()
//   app.use(mashoor.prefix, mashoor.router)          // → /api/mashoor/*
//
// The module keeps its own SQLite database (Backend/mashoor/data/mashoor.db by
// default, node:sqlite — Node 24+), its own cookie sessions and CSRF origin
// check. Settings are read from MASHOOR_* variables only (see config.js).
import { createMashoorRouter } from './app.js'
import { deleteExpiredSessions } from './auth/sessions.js'
import { loadConfig, MASHOOR_API_PREFIX } from './config.js'
import { openDatabase } from './db.js'

export async function createMashoorModule({ env = process.env } = {}) {
  const config = loadConfig(env)
  const db = openDatabase(config.dbPath)

  // Never let a cleanup failure throw out of a timer: inside the shared
  // Backend that would take every other API down with it.
  const cleanup = () => {
    try {
      deleteExpiredSessions(db)
    } catch (error) {
      console.error('[mashoor-api] session cleanup failed:', error.message)
    }
  }
  cleanup()
  const timer = setInterval(cleanup, 60 * 60 * 1000)
  timer.unref()

  console.log(`[mashoor-api] mounted at ${MASHOOR_API_PREFIX} (db: ${config.dbPath})`)
  return {
    prefix: MASHOOR_API_PREFIX,
    router: createMashoorRouter({ db, config }),
    /** Origins the Mashoor frontends are served from (its CSRF allowlist). */
    allowedOrigins: config.allowedOrigins,
    close() {
      clearInterval(timer)
      db.close()
    },
  }
}
