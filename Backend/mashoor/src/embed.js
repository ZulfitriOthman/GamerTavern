// Entry point for running the Mashoor API (catalog sharing: staff admin site +
// vendor portal, Listing-Sample/Mashoor) INSIDE the shared GamerTavern Backend:
//
//   const { createMashoorModule } = await import('./mashoor/src/embed.js')
//   const mashoor = await createMashoorModule()
//   app.use(mashoor.prefix, mashoor.router)          // → /api/mashoor/*
//
// The module keeps its tables (mashoor_*) in MySQL / MariaDB — the Backend's
// database unless MASHOOR_MYSQL_* point elsewhere — with its own pool, cookie
// sessions and CSRF origin check. Settings are read from MASHOOR_* variables,
// falling back to the Backend's MYSQL_* (see config.js). It never falls back to
// another database: when MySQL is unreachable or the schema is not at the
// version of Database/mashoor/mysql/migrations, createMashoorModule() throws.
// That error says why and where — never the credentials.
//
// Live inspection updates (optional): pass the host's Socket.IO server to
//   mashoor.attachRealtime(io)                       // → namespace /mashoor
// See realtime.js.
import { createMashoorRouter } from './app.js'
import { deleteExpiredSessions } from './auth/sessions.js'
import { loadConfig, MASHOOR_API_PREFIX } from './config.js'
import { openDatabase } from './db.js'
import { createRealtime } from './realtime.js'

export async function createMashoorModule({ env = process.env } = {}) {
  const config = loadConfig(env)
  const db = await openDatabase(config.mysql)
  const realtime = createRealtime({ db, config })

  // Never let a cleanup failure throw out of a timer: inside the shared
  // Backend that would take every other API down with it.
  const cleanup = () =>
    deleteExpiredSessions(db).catch((error) => console.error('[mashoor-api] session cleanup failed:', error.message))
  await cleanup()
  const timer = setInterval(cleanup, 60 * 60 * 1000)
  timer.unref()

  console.log(`[mashoor-api] mounted at ${MASHOOR_API_PREFIX} (db: ${db.info.where}, ${db.info.version})`)
  // State only — never the decoy path or token URL.
  if (config.decoyExport.enabled) console.log('[mashoor-api] decoy export alert: enabled')
  else if (config.decoyExport.problem) console.warn(`[mashoor-api] decoy export alert: disabled (${config.decoyExport.problem})`)
  return {
    prefix: MASHOOR_API_PREFIX,
    router: createMashoorRouter({ db, config, realtime }),
    /** Origins the Mashoor frontends are served from (its CSRF allowlist). */
    allowedOrigins: config.allowedOrigins,
    /** { database, version, where } of the connected server (no credentials). */
    database: db.info,
    /** Registers the /mashoor namespace on the host's Socket.IO server. */
    attachRealtime: (io) => realtime.attach(io),
    async close() {
      clearInterval(timer)
      realtime.close()
      await db.close()
    },
  }
}
