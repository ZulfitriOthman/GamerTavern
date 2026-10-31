// The API must start and answer clearly when MySQL is not configured, instead
// of crashing (which leaves the Vite proxy with ECONNREFUSED). Needs no database.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

describe('API without MySQL configuration', () => {
  let server
  let base

  before(async () => {
    Object.assign(process.env, { MYSQL_USER: '', MYSQL_DATABASE: '', IP_HASH_SALT: 'test', DOTENV_FILE: 'does-not-exist.env' })
    const { createPool } = await import('../src/db.js')
    const { createApp } = await import('../src/app.js')
    server = createApp({ db: createPool() }).listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  it('reports degraded health with the reason', async () => {
    const res = await fetch(`${base}/api/health`)
    assert.equal(res.status, 503)
    assert.deepEqual(await res.json(), { success: false, status: 'degraded', api: 'running', database: 'not-configured', schema: 'unknown', data: 'unknown', mediaTypes: false, migrationsRecorded: false })
  })

  it('answers public requests with a friendly 503 instead of crashing', async () => {
    const res = await fetch(`${base}/api/public/site`)
    assert.equal(res.status, 503)
    const body = await res.json()
    assert.equal(body.code, 'DATABASE_UNAVAILABLE')
    assert.doesNotMatch(body.message, /mysql|ECONN|stack/i)
  })

  it('keeps admin endpoints protected (401 before any database access)', async () => {
    const res = await fetch(`${base}/api/admin/stats`)
    assert.equal(res.status, 401)
    assert.equal((await res.json()).success, false)
  })
})
