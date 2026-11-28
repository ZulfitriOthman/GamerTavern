// Decoy inspection export (src/decoy.js): off by default, always a plain 404,
// alerts only the configured Canarytokens URL, throttled, and never touches
// real workflows or data.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { loadConfig } from '../src/config.js'
import { checkTokenUrl, createDecoyExport, sendDecoyAlert } from '../src/decoy.js'
import { Client, insertStaff, startTestServer } from './helpers.js'

const STAFF = { email: 'decoy-staff@mashoor.test', password: 'StaffPass123!' }
const DECOY = '/api/mashoor/admin/exports/inspections.csv'
const TOKEN = 'https://canarytokens.com/about/terms/abc123def/index.html'
const NOT_FOUND = { error: 'Not found.' }

const tick = () => new Promise((resolve) => setImmediate(resolve))
const quietLog = { warn() {}, log() {} }

describe('decoy export settings', () => {
  it('is disabled by default, even when a URL is set', () => {
    assert.equal(loadConfig({}).decoyExport.enabled, false)
    assert.equal(loadConfig({ MASHOOR_DECOY_EXPORT_URL: TOKEN }).decoyExport.enabled, false)
  })

  it('enables only with an exact Canarytokens URL', () => {
    const on = loadConfig({ MASHOOR_DECOY_EXPORT_ENABLED: 'true', MASHOOR_DECOY_EXPORT_URL: TOKEN }).decoyExport
    assert.equal(on.enabled, true)
    assert.equal(on.url, TOKEN)
    assert.equal(on.cooldownMs, 15 * 60_000)
    assert.ok(on.timeoutMs <= 5000)

    for (const bad of ['', 'not a url', 'https://example.com/x', 'https://canarytokens.com.evil.test/x', 'ftp://canarytokens.com/x', 'https://u:p@canarytokens.com/x']) {
      const s = loadConfig({ MASHOOR_DECOY_EXPORT_ENABLED: 'true', MASHOOR_DECOY_EXPORT_URL: bad }).decoyExport
      assert.equal(s.enabled, false, bad)
      assert.ok(s.problem && !s.problem.includes(bad || '\0'), 'problem text never echoes the URL')
    }
    assert.equal(checkTokenUrl('http://canarytokens.com/x'), 'http://canarytokens.com/x')
  })
})

describe('decoy alert request', () => {
  let target
  let seen
  before(async () => {
    target = createServer((req, res) => {
      seen = { method: req.method, url: req.url, headers: req.headers }
      if (req.url === '/hang') return // never answers
      res.end('ok')
    })
    await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve))
  })
  after(() => {
    target.closeAllConnections()
    target.close()
  })

  it('is a plain GET to the exact URL with no cookies or forwarded client details', async () => {
    const base = `http://127.0.0.1:${target.address().port}`
    await sendDecoyAlert(`${base}/about/abc/index.html`, 1000)
    assert.equal(seen.method, 'GET')
    assert.equal(seen.url, '/about/abc/index.html')
    for (const h of ['cookie', 'authorization', 'x-forwarded-for', 'forwarded', 'x-real-ip', 'referer']) {
      assert.equal(seen.headers[h], undefined, h)
    }
  })

  it('gives up after the short timeout', async () => {
    const started = Date.now()
    await assert.rejects(sendDecoyAlert(`http://127.0.0.1:${target.address().port}/hang`, 200), { name: 'TimeoutError' })
    assert.ok(Date.now() - started < 2000)
  })
})

describe('decoy handler throttling', () => {
  function fakeRes() {
    return { statusCode: 0, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
  }

  it('sends one alert per cooldown window and always answers 404', async () => {
    let clock = 1_000_000
    const sent = []
    const handler = createDecoyExport({ url: TOKEN, cooldownMs: 60_000, send: (url) => sent.push(url), now: () => clock, log: quietLog })
    for (let i = 0; i < 5; i += 1) {
      const res = fakeRes()
      handler({ method: 'GET', query: { url: 'https://evil.test' }, headers: {} }, res)
      assert.equal(res.statusCode, 404)
      assert.deepEqual(res.body, NOT_FOUND)
    }
    await tick()
    assert.deepEqual(sent, [TOKEN], 'one alert, to the configured URL only')

    handler({ method: 'HEAD', headers: {} }, fakeRes())
    clock += 60_000
    handler({ method: 'GET', headers: {} }, fakeRes())
    await tick()
    assert.equal(sent.length, 2, 'next window alerts again')
  })

  it('still answers 404 when the alert fails, and never logs the URL', async () => {
    const lines = []
    const log = { warn: (m) => lines.push(m) }
    const handler = createDecoyExport({
      url: TOKEN,
      send: () => Promise.reject(Object.assign(new Error(`fetch failed ${TOKEN}`), { cause: { code: 'ENOTFOUND' } })),
      log,
    })
    const res = fakeRes()
    handler({ method: 'GET', headers: {} }, res)
    assert.equal(res.statusCode, 404)
    await tick()
    await tick()
    assert.ok(lines.some((l) => l.includes('not delivered: ENOTFOUND')), lines.join('\n'))
    assert.ok(lines.every((l) => !l.includes('canarytokens')), 'token URL never logged')
  })
})

describe('decoy route in the API', () => {
  async function serverWith(decoyExport) {
    const server = await startTestServer({ config: { decoyExport } })
    await insertStaff(server.db, STAFF)
    const staff = new Client(server.baseUrl)
    assert.equal((await staff.post('/api/mashoor/admin/auth/login', STAFF)).status, 200)
    return { server, staff, anon: new Client(server.baseUrl) }
  }

  describe('disabled (default)', () => {
    let ctx
    before(async () => { ctx = await serverWith(loadConfig({}).decoyExport) })
    after(() => ctx.server.close())

    it('behaves exactly like any unknown admin path', async () => {
      const unknown = '/api/mashoor/admin/exports/nothing-here.csv'
      assert.deepEqual(await statusBody(ctx.anon, DECOY), await statusBody(ctx.anon, unknown))
      assert.equal((await ctx.anon.get(DECOY)).status, 401)
      assert.deepEqual(await statusBody(ctx.staff, DECOY), { status: 404, body: NOT_FOUND })
    })
  })

  describe('enabled', () => {
    let ctx
    const sent = []
    before(async () => {
      ctx = await serverWith({ enabled: true, url: TOKEN, cooldownMs: 60_000, timeoutMs: 1000, send: (url) => sent.push(url), log: quietLog })
    })
    after(() => ctx.server.close())

    it('does not fire during normal inspection workflows', async () => {
      assert.equal((await ctx.staff.get('/api/mashoor/admin/auth/me')).status, 200)
      assert.equal((await ctx.staff.get('/api/mashoor/admin/inspections')).status, 200)
      assert.equal((await ctx.staff.get('/api/mashoor/admin/dashboard')).status, 200)
      assert.equal((await ctx.anon.get('/api/mashoor/health')).status, 200)
      assert.equal((await ctx.anon.get('/api/mashoor/admin/inspections')).status, 401, 'auth unchanged')
      await tick()
      assert.equal(sent.length, 0)
    })

    it('answers 404 to anyone, serves no data, and alerts once per window', async () => {
      assert.deepEqual(await statusBody(ctx.anon, `${DECOY}?url=https://evil.test`), { status: 404, body: NOT_FOUND })
      assert.deepEqual(await statusBody(ctx.staff, DECOY), { status: 404, body: NOT_FOUND })
      const res = await fetch(ctx.server.baseUrl + DECOY, { redirect: 'manual' })
      assert.equal(res.status, 404)
      assert.equal(res.headers.get('location'), null)
      assert.equal(res.headers.get('cache-control'), 'no-store')
      await tick()
      assert.deepEqual(sent, [TOKEN])
    })

    it('is GET-only', async () => {
      assert.equal((await ctx.anon.post(DECOY, {})).status, 401)
      assert.equal((await ctx.staff.post(DECOY, {})).status, 404)
      await tick()
      assert.equal(sent.length, 1)
    })
  })
})

async function statusBody(client, path) {
  const res = await client.get(path)
  return { status: res.status, body: res.body }
}
