// Regression tests for the API response boundary.
// Production incident (2026-10-27): the live static host answered /api/* with
// index.html (HTTP 200). The client turned that into `{}`, and
// listApprovedPhotos() crashed on `photos.map` ("Cannot read properties of
// undefined (reading 'map')"). These tests pin the contract so a non-API
// response becomes a clear error, while valid empty collections still work.
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { defaultContent } from '../src/config/defaultContent.js'
import { ApiError, parse } from '../src/lib/api.js'
import { deepMerge } from '../src/lib/merge.js'
import { listApprovedGreetings } from '../src/services/greetingsService.js'
import { listApprovedPhotos } from '../src/services/photoService.js'
import { loadPublicSite } from '../src/services/contentService.js'

const INDEX_HTML = '<!doctype html><html lang="en"><head><title>Zulfitri &amp; Mariah</title></head><body><div id="root"></div></body></html>'
const realFetch = globalThis.fetch
const quiet = console.error

/** Makes fetch answer with the given status/body (string or object). */
function respond(status, body, contentType = typeof body === 'string' ? 'text/html' : 'application/json') {
  globalThis.fetch = async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

afterEach(() => {
  globalThis.fetch = realFetch
  console.error = quiet
})

const rejectsWith = (promise, code) =>
  assert.rejects(promise, (e) => e instanceof ApiError && e.code === code && typeof e.userMessage === 'string')

describe('parse(): response envelope', () => {
  it('accepts a success envelope', () => {
    assert.deepEqual(parse(200, '{"success":true,"photos":[]}'), { success: true, photos: [] })
  })
  it('rejects an HTML page returned with 200 (SPA fallback) instead of returning {}', () => {
    assert.throws(() => parse(200, INDEX_HTML), (e) => e.code === 'INVALID_RESPONSE')
  })
  it('rejects empty, non-object and envelope-less 2xx bodies', () => {
    for (const body of ['', 'OK', '[]', 'null', '{"photos":[]}']) {
      assert.throws(() => parse(200, body), (e) => e.code === 'INVALID_RESPONSE', body)
    }
  })
  it('surfaces API error messages and codes', () => {
    assert.throws(
      () => parse(503, '{"success":false,"code":"DATABASE_UNAVAILABLE","message":"The website is temporarily unavailable."}'),
      (e) => e.status === 503 && e.code === 'DATABASE_UNAVAILABLE' && e.userMessage === 'The website is temporarily unavailable.',
    )
  })
  it('maps proxy/gateway failures without a JSON body', () => {
    assert.throws(() => parse(502, 'error code: 502'), (e) => e.code === 'BAD_GATEWAY' && /could not reach/.test(e.userMessage))
    assert.throws(() => parse(404, INDEX_HTML), (e) => e.code === 'NOT_FOUND')
  })
})

describe('loadPublicSite()', () => {
  it('accepts valid empty collections and a missing (null) settings row', async () => {
    respond(200, { success: true, settings: null, events: [], albums: [] })
    assert.deepEqual(await loadPublicSite(), { settings: null, events: [], albums: [] })
  })
  it('returns real data unchanged', async () => {
    const settings = { wedding_date: '2027-01-01', content: { couple: { partnerOne: 'Zulfitri', partnerTwo: 'Mariah' } } }
    const events = [{ id: 'e1', title: 'Majlis Bersanding', programme: [] }]
    respond(200, { success: true, settings, events, albums: [{ id: 'a1', slug: 'couple' }] })
    const site = await loadPublicSite()
    assert.equal(site.settings.wedding_date, '2027-01-01')
    assert.equal(site.events[0].title, 'Majlis Bersanding')
  })
  it('production incident: index.html instead of JSON → clear error, not undefined data', async () => {
    respond(200, INDEX_HTML)
    await rejectsWith(loadPublicSite(), 'INVALID_RESPONSE')
  })
  it('rejects responses missing required collections or with malformed settings', async () => {
    console.error = () => {}
    respond(200, { success: true, settings: null, albums: [] })
    await rejectsWith(loadPublicSite(), 'INVALID_RESPONSE')
    respond(200, { success: true, settings: null, events: {}, albums: [] })
    await rejectsWith(loadPublicSite(), 'INVALID_RESPONSE')
    respond(200, { success: true, settings: [], events: [], albums: [] })
    await rejectsWith(loadPublicSite(), 'INVALID_RESPONSE')
  })
  it('passes through API errors (e.g. database unavailable)', async () => {
    respond(503, { success: false, code: 'DATABASE_UNAVAILABLE', message: 'The website is temporarily unavailable.' })
    await rejectsWith(loadPublicSite(), 'DATABASE_UNAVAILABLE')
  })
  it('reports network failures as TypeError (handled as "could not reach the server")', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await assert.rejects(loadPublicSite(), (e) => e.name === 'TypeError')
  })
})

describe('listApprovedPhotos() — the function that crashed in production', () => {
  it('returns [] for an empty gallery', async () => {
    respond(200, { success: true, photos: [] })
    assert.deepEqual(await listApprovedPhotos(), [])
  })
  it('resolves media URLs for approved photos', async () => {
    respond(200, { success: true, photos: [{ id: 'p1', url: '/media/photos/p1/full?v=1', thumbUrl: '/media/photos/p1/thumb?v=1' }] })
    const [photo] = await listApprovedPhotos()
    assert.equal(photo.url, '/api/wedding/media/photos/p1/full?v=1')
    assert.equal(photo.thumbUrl, '/api/wedding/media/photos/p1/thumb?v=1')
  })
  it('does not throw "reading \'map\'" when the API is misrouted', async () => {
    respond(200, INDEX_HTML)
    await rejectsWith(listApprovedPhotos(), 'INVALID_RESPONSE')
  })
  it('rejects a response without a photos array', async () => {
    console.error = () => {}
    respond(200, { success: true })
    await rejectsWith(listApprovedPhotos(), 'INVALID_RESPONSE')
  })
})

describe('listApprovedGreetings()', () => {
  it('returns an empty guestbook', async () => {
    respond(200, { success: true, items: [], hasMore: false })
    assert.deepEqual(await listApprovedGreetings(0), { items: [], hasMore: false })
  })
  it('rejects a misrouted or malformed response', async () => {
    console.error = () => {}
    respond(200, INDEX_HTML)
    await rejectsWith(listApprovedGreetings(0), 'INVALID_RESPONSE')
    respond(200, { success: true, items: null })
    await rejectsWith(listApprovedGreetings(0), 'INVALID_RESPONSE')
  })
})

describe('content initialisation (optional collections)', () => {
  it('defaults keep every optional collection as an array', () => {
    assert.ok(Array.isArray(defaultContent.story.timeline))
    assert.ok(Array.isArray(defaultContent.info.faq))
    assert.ok(Array.isArray(defaultContent.info.contacts))
  })
  it('saved content with empty optional collections stays valid and keeps verified details', () => {
    const merged = deepMerge(defaultContent, { story: { timeline: [] }, info: { faq: [], contacts: [] } })
    assert.deepEqual(merged.story.timeline, [])
    assert.equal(merged.couple.fullNameOne, 'Awang Muhammad Zulfitri Bin Othman')
    assert.equal(merged.couple.fullNameTwo, 'Dayang Siti Mariah Binti Abdullah @ Md Yusof')
  })
})

describe('API base URL (VITE_API_BASE)', async () => {
  const { resolveApiBase } = await import('../src/lib/api.js')
  it('appends the wedding API path to the backend origin', () => {
    assert.equal(resolveApiBase('https://backend.nanashicollectibles.com'), 'https://backend.nanashicollectibles.com/api/wedding')
  })
  it('normalises trailing slashes and an already-included /api or /api/wedding', () => {
    for (const v of ['https://backend.nanashicollectibles.com/', 'https://backend.nanashicollectibles.com/api', 'https://backend.nanashicollectibles.com/api/wedding/']) {
      assert.equal(resolveApiBase(v), 'https://backend.nanashicollectibles.com/api/wedding', v)
    }
  })
  it('uses the same origin when unset (dev proxy)', () => {
    assert.equal(resolveApiBase(undefined), '/api/wedding')
    assert.equal(resolveApiBase(''), '/api/wedding')
  })
})

describe('submitGreeting(): success only when the server confirms the saved wish', async () => {
  const { submitGreeting } = await import('../src/services/greetingsService.js')
  const wish = { name: 'Aminah', message: 'Selamat pengantin baru!', relationship: 'Sepupu' }
  it('returns the published wish so the page can show it immediately', async () => {
    respond(201, { success: true, status: 'published', item: { id: 'w1', ...wish, created_at: '2027-01-01T06:00:00.000Z' } })
    const r = await submitGreeting(wish)
    assert.equal(r.status, 'published')
    assert.equal(r.item.id, 'w1')
  })
  it('reports duplicates without claiming a new post', async () => {
    respond(201, { success: true, status: 'duplicate' })
    assert.deepEqual(await submitGreeting(wish), { status: 'duplicate' })
  })
  it('does not show success if the server did not return the saved wish', async () => {
    respond(201, { success: true, status: 'pending' })
    await rejectsWith(submitGreeting(wish), 'INVALID_RESPONSE')
    respond(200, INDEX_HTML)
    await rejectsWith(submitGreeting(wish), 'INVALID_RESPONSE')
  })
  it('passes through validation / rate-limit messages', async () => {
    respond(429, { success: false, code: 'RATE_LIMITED', message: 'You have sent several messages recently. Please try again a little later.' })
    await rejectsWith(submitGreeting(wish), 'RATE_LIMITED')
  })
})

describe('homepage Wishes Wall data', async () => {
  const { listApprovedGreetings } = await import('../src/services/greetingsService.js')
  it('asks the server for only the latest N wishes', async () => {
    let requested
    globalThis.fetch = async (url) => {
      requested = url
      return Response.json({ success: true, items: [], hasMore: false })
    }
    await listApprovedGreetings(0, { limit: 6 })
    assert.match(requested, /\/api\/wedding\/public\/greetings\?page=0&limit=6$/)
  })
  it('never returns more than requested, even if an older backend ignores the limit', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, name: `Guest ${i}`, message: 'Tahniah', created_at: '2027-01-01T00:00:00Z' }))
    respond(200, { success: true, items: many, hasMore: false })
    const { items } = await listApprovedGreetings(0, { limit: 6 })
    assert.deepEqual(items.map((w) => w.id), ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'])
  })
  it('an empty guestbook is a valid, empty list (empty state, no crash)', async () => {
    respond(200, { success: true, items: [], hasMore: false })
    assert.deepEqual(await listApprovedGreetings(0, { limit: 6 }), { items: [], hasMore: false })
  })
})
