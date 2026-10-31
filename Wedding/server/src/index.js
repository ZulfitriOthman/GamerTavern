import { createApp } from './app.js'
import { config } from './config.js'
import { checkSchema, createPool } from './db.js'
import { ensureUploadDir, sweepTemp } from './lib/storage.js'
import { cleanup } from './services/rateLimit.js'

const db = createPool()
await ensureUploadDir()
await checkSchema(db) // warns only — tables are created manually with the SQL scripts, never on startup

const app = createApp({ db })
const server = app.listen(config.port, () => {
  console.log(`[wedding-api] listening on http://localhost:${config.port} (${config.isProduction ? 'production' : 'development'})`)
  console.log(`[wedding-api] uploads → ${config.uploads.dir}`)
})

const timer = setInterval(() => {
  cleanup(db).catch((e) => console.error('[wedding-api] cleanup failed', e.code || e.message))
  sweepTemp().catch(() => {})
}, 60 * 60 * 1000)
timer.unref()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => db.end().finally(() => process.exit(0)))
  })
}
