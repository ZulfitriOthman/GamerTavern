// Mounts the module exactly as Backend/server.js does — inside a host app that
// has its own routes — and checks the two never leak into each other.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { createMashoorModule } from '../src/embed.js'
import { APP_ORIGIN } from './helpers.js'

describe('embedded in the shared Backend', () => {
  let server
  let mashoor
  let baseUrl

  before(async () => {
    mashoor = await createMashoorModule({ env: {
      MASHOOR_DB_PATH: ':memory:',
      MASHOOR_STORAGE_DIR: mkdtempSync(join(tmpdir(), 'mashoor-test-')),
      MASHOOR_ALLOWED_ORIGINS: APP_ORIGIN,
    } })
    const host = express()
    host.use(mashoor.prefix, mashoor.router)
    host.use(express.json({ limit: '5mb' }))
    host.get('/api/admin/ping', (req, res) => res.json({ host: true }))
    host.post('/api/echo', (req, res) => res.json({ size: JSON.stringify(req.body).length }))
    server = await new Promise((resolve) => {
      const s = host.listen(0, '127.0.0.1', () => resolve(s))
    })
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })
  after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    mashoor.close()
  })

  it('serves Mashoor under /api/mashoor without X-Powered-By', async () => {
    assert.equal(mashoor.prefix, '/api/mashoor')
    const res = await fetch(`${baseUrl}/api/mashoor/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('cache-control'), 'no-store')
  })

  it('answers unknown Mashoor paths itself with a JSON 404', async () => {
    const res = await fetch(`${baseUrl}/api/mashoor/nope`)
    assert.equal(res.status, 404)
    assert.deepEqual(await res.json(), { error: 'Not found.' })
  })

  it('leaves the host app routes (including its own /api/admin) untouched', async () => {
    const ping = await fetch(`${baseUrl}/api/admin/ping`)
    assert.deepEqual(await ping.json(), { host: true })
    const big = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: 'x'.repeat(200_000) }),
    })
    assert.equal(big.status, 200)
  })

  it('keeps its own 100kb body limit and CSRF origin check', async () => {
    const tooBig = await fetch(`${baseUrl}/api/mashoor/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
      body: JSON.stringify({ email: 'a@b.test', password: 'x'.repeat(200_000) }),
    })
    assert.equal(tooBig.status, 413)

    const evil = await fetch(`${baseUrl}/api/mashoor/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'a@b.test', password: 'whatever-123' }),
    })
    assert.equal(evil.status, 403)
  })

  it('still protects admin routes', async () => {
    assert.equal((await fetch(`${baseUrl}/api/mashoor/admin/vendors`)).status, 401)
    assert.equal((await fetch(`${baseUrl}/api/mashoor/portal/auth/me`)).status, 401)
  })
})
