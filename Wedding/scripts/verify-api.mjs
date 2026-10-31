// Read-only check that a wedding API host is wired up correctly for the site.
//   npm run verify:api                                  → https://backend.nanashicollectibles.com
//   npm run verify:api -- http://localhost:4100         → any other host
// Makes no changes: only GET requests and a CORS preflight (OPTIONS).
const host = (process.argv[2] || 'https://backend.nanashicollectibles.com').replace(/\/+$/, '')
const origins = ['https://wedding.nanashicollectibles.com', 'https://devwedding.nanashicollectibles.com']
const api = `${host}/api/wedding`
let failures = 0

async function check(label, fn) {
  try {
    const detail = await fn()
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    failures++
    console.log(`  ✗ ${label} — ${error.message}`)
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

console.log(`Wedding API at ${api}\n`)

await check('health', async () => {
  const r = await fetch(`${api}/health`)
  const body = await r.json().catch(() => null)
  expect(body?.api === 'running', `HTTP ${r.status} — not the wedding API (Backend restarted with the wedding module?)`)
  return `database=${body.database}, schema=${body.schema}, data=${body.data}, mediaTypes=${body.mediaTypes}`
})

await check('public site data', async () => {
  const r = await fetch(`${api}/public/site`, { headers: { origin: origins[0] } })
  const body = await r.json().catch(() => null)
  expect(r.ok && body?.success === true, `HTTP ${r.status}`)
  expect(Array.isArray(body.events) && Array.isArray(body.albums), 'events/albums missing')
  return `${body.settings?.content?.couple?.partnerOne ?? '?'} & ${body.settings?.content?.couple?.partnerTwo ?? '?'}, ${body.events.length} event(s)`
})

for (const origin of origins) {
  await check(`CORS for ${origin}`, async () => {
    const r = await fetch(`${api}/public/site`, { headers: { origin } })
    expect(r.headers.get('access-control-allow-origin') === origin, `allow-origin is "${r.headers.get('access-control-allow-origin')}" (add it to EXTRA_ORIGINS / ALLOWED_ORIGINS)`)
    expect(r.headers.get('access-control-allow-credentials') === 'true', 'credentials not allowed')
  })
}

await check('CORS preflight for admin writes (X-CSRF-Token)', async () => {
  const r = await fetch(`${api}/admin/settings`, {
    method: 'OPTIONS',
    headers: { origin: origins[0], 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type,x-csrf-token' },
  })
  expect(r.status === 204 || r.status === 200, `HTTP ${r.status}`)
  expect(/x-csrf-token/i.test(r.headers.get('access-control-allow-headers') ?? ''), 'X-CSRF-Token not in allowed headers')
})

await check('gallery list', async () => {
  const body = await (await fetch(`${api}/public/photos?limit=3`)).json()
  expect(Array.isArray(body.photos), 'photos is not an array')
  if (body.photos[0]) {
    const media = await fetch(`${api}${body.photos[0].thumbUrl ?? body.photos[0].url}`, { method: 'HEAD' })
    expect(media.ok, `first media file → HTTP ${media.status}`)
  }
  return `${body.photos.length} item(s) checked`
})

await check('unknown wedding path returns JSON 404', async () => {
  const r = await fetch(`${api}/does-not-exist`)
  expect(r.status === 404 && (r.headers.get('content-type') ?? '').includes('json'), `HTTP ${r.status} ${r.headers.get('content-type')}`)
})

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
