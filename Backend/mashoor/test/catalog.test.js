// End-to-end over real HTTP sessions: admin manages categories, vendors and
// listings; two vendors with different category assignments see only what
// the access rule allows — through list, detail, search, filter and image.
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { APP_ORIGIN, Client, insertStaff, startTestServer, TINY_PNG } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const PORTAL_ORIGIN = { headers: { origin: 'http://localhost:5302' } }
const NEW_A = 'AlicesOwnPass-2026'
const NEW_B = 'BobsOwnPass-2026!!'

describe('categories, listings and category-based vendor access', () => {
  let server
  let staff
  const ids = {}
  const temp = {}
  let alice
  let bob

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Test Staff' })
    staff = new Client(server.baseUrl)
    assert.equal((await staff.post('/api/mashoor/admin/auth/login', STAFF)).status, 200)
  })
  after(() => server.close())

  it('creates categories and rejects normalized duplicates', async () => {
    const chairs = await staff.post('/api/mashoor/admin/categories', { name: '  Office   Chairs ', description: 'Seating' })
    assert.equal(chairs.status, 201)
    assert.equal(chairs.body.category.name, 'Office Chairs')
    ids.chairs = chairs.body.category.id

    for (const name of ['office chairs', 'OFFICE  CHAIRS', 'Ｏｆｆｉｃｅ Chairs']) {
      const dup = await staff.post('/api/mashoor/admin/categories', { name })
      assert.equal(dup.status, 409, name)
      assert.equal(dup.body.error, 'A category named "Office Chairs" already exists.')
    }
    ids.desks = (await staff.post('/api/mashoor/admin/categories', { name: 'Desks' })).body.category.id
    ids.lamps = (await staff.post('/api/mashoor/admin/categories', { name: 'Lamps' })).body.category.id

    const rename = await staff.patch(`/api/mashoor/admin/categories/${ids.lamps}`, { name: 'desks' })
    assert.equal(rename.status, 409)
    assert.equal((await staff.post('/api/mashoor/admin/categories', { name: '   ' })).status, 400)
  })

  it('creates vendor accounts with an admin-chosen username and password (no email, hash only stored)', async () => {
    temp.alice = 'AliceInitial-2026'
    temp.bob = 'BobInitial-2026!'
    const a = await staff.post('/api/mashoor/admin/vendors', {
      name: 'Vendor A Sdn Bhd',
      status: 'active',
      account: { name: 'Alice', username: ' Alice.A ', password: temp.alice, confirmPassword: temp.alice },
    })
    assert.equal(a.status, 201)
    assert.equal(a.body.user.username, 'alice.a', 'usernames are stored lower-cased and trimmed')
    assert.equal(a.body.temporaryPassword, undefined)
    assert.equal(JSON.stringify(a.body).includes(temp.alice), false, 'passwords are never returned')
    assert.equal(server.db.prepare('SELECT email FROM vendor_users WHERE id = ?').get(a.body.user.id).email, null)
    ids.vendorA = a.body.vendor.id
    ids.alice = a.body.user.id

    const b = await staff.post('/api/mashoor/admin/vendors', {
      name: 'Vendor B Sdn Bhd',
      account: { name: 'Bob', username: 'bob', password: temp.bob },
    })
    ids.vendorB = b.body.vendor.id
    ids.bob = b.body.user.id

    const dup = await staff.post('/api/mashoor/admin/vendors', { name: 'X', account: { name: 'X', username: 'ALICE.A', password: 'Whatever-123' } })
    assert.equal(dup.status, 409)
    assert.equal(dup.body.error, 'That username is already taken.')
    const mismatch = await staff.post('/api/mashoor/admin/vendors', {
      name: 'X',
      account: { name: 'X', username: 'x-co', password: 'Whatever-123', confirmPassword: 'Whatever-124' },
    })
    assert.equal(mismatch.status, 400)
    for (const username of ['ab', 'has space', 'bad@char', '-leading', 'x'.repeat(41)]) {
      const bad = await staff.post('/api/mashoor/admin/vendors', { name: 'X', account: { name: 'X', username, password: 'Whatever-123' } })
      assert.equal(bad.status, 400, username)
    }
    const weak = await staff.post('/api/mashoor/admin/vendors', { name: 'X', account: { name: 'X', username: 'x-co', password: 'short' } })
    assert.equal(weak.status, 400)
    const list = await staff.get('/api/mashoor/admin/vendors')
    assert.equal(JSON.stringify(list.body).includes('scrypt'), false, 'no password hashes in list responses')
    assert.deepEqual(list.body.vendors.find((v) => v.id === ids.vendorA).accounts.map((u) => u.username), ['alice.a'])
    assert.equal(server.db.prepare("SELECT COUNT(*) AS n FROM vendor_companies WHERE name = 'X'").get().n, 0)

    const stored = server.db.prepare('SELECT password_hash FROM vendor_users WHERE id = ?').get(ids.alice).password_hash
    assert.match(stored, /^scrypt\$/)
    const audit = JSON.stringify(server.db.prepare('SELECT * FROM audit_log').all())
    assert.ok(!audit.includes(temp.alice) && !audit.includes(temp.bob), 'passwords must never be logged')
  })

  it('assigns categories per vendor', async () => {
    const a = await staff.put(`/api/mashoor/admin/vendors/${ids.vendorA}/categories`, { categoryIds: [ids.chairs] })
    assert.equal(a.status, 200)
    assert.deepEqual(a.body.categories.map((c) => c.name), ['Office Chairs'])
    await staff.put(`/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: [ids.desks] })
    assert.equal((await staff.put(`/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: [9999] })).status, 400)
    assert.equal((await staff.put(`/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: 'x' })).status, 400)
    const detail = await staff.get(`/api/mashoor/admin/vendors/${ids.vendorB}`)
    assert.deepEqual(detail.body.categories.map((c) => c.name), ['Desks'])
  })

  it('creates, prices, illustrates and publishes listings', async () => {
    const chair = await staff.post('/api/mashoor/admin/listings', {
      title: 'Ergo Chair',
      description: 'Mesh back',
      categoryId: ids.chairs,
      price: '199.9',
    })
    assert.equal(chair.status, 201)
    assert.equal(chair.body.listing.status, 'draft')
    assert.equal(chair.body.listing.priceCents, 19990)
    ids.chair = chair.body.listing.id

    const up = await staff.upload(`/api/mashoor/admin/listings/${ids.chair}/image`, TINY_PNG)
    assert.equal(up.status, 200)
    assert.equal(up.body.listing.hasImage, true)
    assert.equal(readdirSync(join(server.storageDir, 'listings')).length, 1)

    const fake = await staff.upload(`/api/mashoor/admin/listings/${ids.chair}/image`, Buffer.from('<svg onload=alert(1)>'), {
      filename: 'x.png',
    })
    assert.equal(fake.status, 400)

    const pub = await staff.patch(`/api/mashoor/admin/listings/${ids.chair}`, { status: 'published' })
    assert.equal(pub.body.listing.status, 'published')
    assert.ok(pub.body.listing.publishedAt)

    ids.desk = (
      await staff.post('/api/mashoor/admin/listings', { title: 'Standing Desk', categoryId: ids.desks, status: 'published' })
    ).body.listing.id
    ids.deskDraft = (await staff.post('/api/mashoor/admin/listings', { title: 'Desk draft', categoryId: ids.desks })).body.listing.id
    ids.lamp = (
      await staff.post('/api/mashoor/admin/listings', { title: 'Desk Lamp', categoryId: ids.lamps, status: 'published' })
    ).body.listing.id

    assert.equal((await staff.post('/api/mashoor/admin/listings', { title: 'No category' })).status, 400)
    assert.equal((await staff.post('/api/mashoor/admin/listings', { title: 'Bad', categoryId: ids.chairs, price: '1.999' })).status, 400)
  })

  it('filters and searches listings for admin with pagination', async () => {
    const published = await staff.get('/api/mashoor/admin/listings?status=published')
    assert.equal(published.body.pagination.total, 3)
    const desks = await staff.get(`/api/mashoor/admin/listings?categoryId=${ids.desks}`)
    assert.deepEqual(desks.body.listings.map((l) => l.title).sort(), ['Desk draft', 'Standing Desk'])
    const search = await staff.get('/api/mashoor/admin/listings?q=mesh')
    assert.deepEqual(search.body.listings.map((l) => l.title), ['Ergo Chair'])
    const paged = await staff.get('/api/mashoor/admin/listings?limit=2&page=2')
    assert.deepEqual(paged.body.pagination, { page: 2, limit: 2, total: 4, pages: 2 })
    assert.equal(paged.body.listings.length, 2)
    assert.equal((await staff.get('/api/mashoor/admin/listings?status=nope')).status, 400)
  })

  it('lets a vendor use the admin-given password straight away, and change it voluntarily', async () => {
    alice = new Client(server.baseUrl)
    const login = await alice.post('/api/mashoor/portal/auth/login', { username: 'alice.a', password: temp.alice })
    assert.equal(login.status, 200)
    assert.equal(login.body.mustChangePassword, undefined)
    assert.equal((await alice.get('/api/mashoor/portal/listings')).status, 200)
    assert.equal((await alice.get(`/api/mashoor/portal/listings/${ids.chair}/image`)).status, 200)

    const same = await alice.post(
      '/api/mashoor/portal/auth/change-password',
      { currentPassword: temp.alice, newPassword: temp.alice },
      PORTAL_ORIGIN,
    )
    assert.equal(same.status, 400)
    const changed = await alice.post(
      '/api/mashoor/portal/auth/change-password',
      { currentPassword: temp.alice, newPassword: NEW_A },
      PORTAL_ORIGIN,
    )
    assert.equal(changed.status, 204)
    assert.equal((await alice.get('/api/mashoor/portal/listings')).status, 200)

    bob = new Client(server.baseUrl)
    await bob.post('/api/mashoor/portal/auth/login', { username: 'bob', password: temp.bob })
    await bob.post('/api/mashoor/portal/auth/change-password', { currentPassword: temp.bob, newPassword: NEW_B }, PORTAL_ORIGIN)
  })

  it('shows each vendor only published listings in its assigned categories', async () => {
    const a = await alice.get('/api/mashoor/portal/listings')
    assert.deepEqual(a.body.listings.map((l) => l.title), ['Ergo Chair'])
    assert.equal(a.body.listings[0].priceCents, 19990)
    assert.equal(a.body.listings[0].status, undefined, 'internal fields are not exposed')
    assert.deepEqual((await alice.get('/api/mashoor/portal/categories')).body.categories.map((c) => c.name), ['Office Chairs'])
    const img = await alice.raw(`/api/mashoor/portal/listings/${ids.chair}/image`)
    assert.equal(img.status, 200)
    assert.equal(img.headers.get('content-type'), 'image/png')
    assert.ok(img.bytes.equals(TINY_PNG))

    const b = await bob.get('/api/mashoor/portal/listings')
    assert.deepEqual(b.body.listings.map((l) => l.title), ['Standing Desk'], 'drafts never show')
  })

  it('denies a vendor without the category on every route, whatever ids it sends', async () => {
    assert.equal((await bob.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 404)
    assert.equal((await bob.raw(`/api/mashoor/portal/listings/${ids.chair}/image`)).status, 404)
    assert.deepEqual((await bob.get(`/api/mashoor/portal/listings?categoryId=${ids.chairs}`)).body.listings, [])
    assert.deepEqual((await bob.get('/api/mashoor/portal/listings?q=Ergo')).body.listings, [])
    assert.deepEqual((await bob.get(`/api/mashoor/portal/listings?vendorId=${ids.vendorA}&companyId=${ids.vendorA}`)).body.listings.map((l) => l.title), ['Standing Desk'])
    assert.equal((await bob.get(`/api/mashoor/portal/listings/${ids.deskDraft}`)).status, 404)
    assert.equal((await bob.get(`/api/mashoor/portal/listings/${ids.lamp}`)).status, 404)
  })

  it('keeps the portal read-only', async () => {
    for (const [method, path] of [
      ['POST', '/api/mashoor/portal/listings'],
      ['PATCH', `/api/mashoor/portal/listings/${ids.desk}`],
      ['PUT', `/api/mashoor/portal/listings/${ids.desk}/image`],
      ['DELETE', `/api/mashoor/portal/listings/${ids.desk}`],
    ]) {
      assert.equal((await bob.request(method, path, { body: {}, ...PORTAL_ORIGIN })).status, 404, `${method} ${path}`)
    }
  })

  it('applies category reassignment on the very next request', async () => {
    await staff.put(`/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: [ids.desks, ids.chairs] })
    assert.equal((await bob.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 200)
    await staff.put(`/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: [ids.desks] })
    assert.equal((await bob.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 404)
  })

  it('removes access when a listing is unpublished or archived, or its category deactivated', async () => {
    await staff.patch(`/api/mashoor/admin/listings/${ids.chair}`, { status: 'draft' })
    assert.equal((await alice.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 404)
    assert.equal((await alice.raw(`/api/mashoor/portal/listings/${ids.chair}/image`)).status, 404)
    await staff.patch(`/api/mashoor/admin/listings/${ids.chair}`, { status: 'published' })
    assert.equal((await alice.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 200)

    await staff.patch(`/api/mashoor/admin/categories/${ids.chairs}`, { active: false })
    assert.equal((await alice.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 404)
    assert.deepEqual((await alice.get('/api/mashoor/portal/categories')).body.categories, [])
    await staff.patch(`/api/mashoor/admin/categories/${ids.chairs}`, { active: true })

    await staff.patch(`/api/mashoor/admin/listings/${ids.chair}`, { status: 'archived' })
    assert.equal((await alice.get(`/api/mashoor/portal/listings/${ids.chair}`)).status, 404)
    await staff.patch(`/api/mashoor/admin/listings/${ids.chair}`, { status: 'published' })
  })

  it('refuses to delete a category still in use and explains what to reassign', async () => {
    const inUse = await staff.delete(`/api/mashoor/admin/categories/${ids.desks}`)
    assert.equal(inUse.status, 409)
    assert.equal(inUse.body.listingCount, 2)
    assert.equal(inUse.body.vendorCount, 1)
    assert.match(inUse.body.error, /move its 2 listings .* remove it from 1 vendor/)

    const unused = (await staff.post('/api/mashoor/admin/categories', { name: 'Temporary' })).body.category.id
    assert.equal((await staff.delete(`/api/mashoor/admin/categories/${unused}`)).status, 204)
  })

  it('reports dashboard totals from the database', async () => {
    const { body } = await staff.get('/api/mashoor/admin/dashboard')
    assert.deepEqual(body.totals.vendors, { total: 2, active: 2 })
    assert.deepEqual(body.totals.vendorAccounts, { total: 2, active: 2 })
    assert.deepEqual(body.totals.categories, { total: 3, active: 3 })
    assert.deepEqual(body.totals.listings, { total: 4, draft: 1, published: 3, archived: 0 })
  })

  it('a vendor with no categories gets an empty catalog, not an error', async () => {
    await staff.post('/api/mashoor/admin/vendors', { name: 'Vendor C', account: { name: 'Carol', username: 'carol', password: 'CarolInitial-2026' } })
    const carol = new Client(server.baseUrl)
    await carol.post('/api/mashoor/portal/auth/login', { username: 'carol', password: 'CarolInitial-2026' })
    await carol.post(
      '/api/mashoor/portal/auth/change-password',
      { currentPassword: 'CarolInitial-2026', newPassword: 'CarolsOwnPass-2026' },
      PORTAL_ORIGIN,
    )
    const res = await carol.get('/api/mashoor/portal/listings')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.listings, [])
    assert.deepEqual((await carol.get('/api/mashoor/portal/categories')).body.categories, [])
  })

  it('blocks a deactivated vendor: existing session and future logins', async () => {
    assert.equal((await alice.get('/api/mashoor/portal/listings')).status, 200)
    await staff.patch(`/api/mashoor/admin/vendor-users/${ids.alice}`, { active: false })
    assert.equal((await alice.get('/api/mashoor/portal/listings')).status, 401)
    assert.equal((await alice.raw(`/api/mashoor/portal/listings/${ids.chair}/image`)).status, 401)
    const relogin = await new Client(server.baseUrl).post('/api/mashoor/portal/auth/login', { username: 'alice.a', password: NEW_A })
    assert.equal(relogin.status, 401)

    // Suspending the whole company (vendor "account status") does the same.
    await staff.patch(`/api/mashoor/admin/vendors/${ids.vendorB}`, { status: 'suspended' })
    assert.equal((await bob.get('/api/mashoor/portal/listings')).status, 401)
    assert.equal(
      (await new Client(server.baseUrl).post('/api/mashoor/portal/auth/login', { username: 'bob', password: NEW_B })).status,
      401,
    )
  })

  it('protects every admin endpoint from vendors and anonymous callers', async () => {
    await staff.patch(`/api/mashoor/admin/vendors/${ids.vendorB}`, { status: 'active' })
    const vendor = new Client(server.baseUrl)
    assert.equal((await vendor.post('/api/mashoor/portal/auth/login', { username: 'bob', password: NEW_B })).status, 200)
    const endpoints = [
      ['GET', '/api/mashoor/admin/dashboard'],
      ['GET', '/api/mashoor/admin/categories'],
      ['POST', '/api/mashoor/admin/categories', { name: 'Hack' }],
      ['PATCH', `/api/mashoor/admin/categories/${ids.desks}`, { active: false }],
      ['DELETE', `/api/mashoor/admin/categories/${ids.lamps}`],
      ['PUT', `/api/mashoor/admin/vendors/${ids.vendorB}/categories`, { categoryIds: [ids.chairs] }],
      ['GET', '/api/mashoor/admin/listings'],
      ['GET', `/api/mashoor/admin/listings/${ids.chair}`],
      ['POST', '/api/mashoor/admin/listings', { title: 'x', categoryId: ids.desks }],
      ['PATCH', `/api/mashoor/admin/listings/${ids.deskDraft}`, { status: 'published' }],
      ['GET', `/api/mashoor/admin/listings/${ids.chair}/image`],
      ['DELETE', `/api/mashoor/admin/listings/${ids.chair}/image`],
    ]
    for (const client of [vendor, new Client(server.baseUrl)]) {
      for (const [method, path, body] of endpoints) {
        const res = await client.request(method, path, { body })
        assert.equal(res.status, 401, `${method} ${path}`)
      }
    }
    assert.equal((await vendor.upload(`/api/mashoor/admin/listings/${ids.chair}/image`, TINY_PNG)).status, 401)
    assert.equal(server.db.prepare("SELECT status FROM catalogs WHERE id = ?").get(ids.deskDraft).status, 'draft')
  })

  it('rejects admin writes from unknown browser origins (CSRF)', async () => {
    const evil = await staff.post('/api/mashoor/admin/categories', { name: 'CSRF' }, { headers: { origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    const good = await staff.post('/api/mashoor/admin/categories', { name: 'Allowed' }, { headers: { origin: APP_ORIGIN } })
    assert.equal(good.status, 201)
  })

  it('admin reset: old password fails, the new one works immediately with catalog access', async () => {
    const reset = await staff.post(`/api/mashoor/admin/vendor-users/${ids.bob}/reset-password`, {
      password: 'BobResetByAdmin-1',
      confirmPassword: 'BobResetByAdmin-1',
    })
    assert.equal(reset.status, 200)
    const fresh = new Client(server.baseUrl)
    assert.equal((await fresh.post('/api/mashoor/portal/auth/login', { username: 'bob', password: NEW_B })).status, 401)
    const login = await fresh.post('/api/mashoor/portal/auth/login', { username: 'bob', password: 'BobResetByAdmin-1' })
    assert.equal(login.status, 200)
    assert.equal((await fresh.get('/api/mashoor/portal/listings')).status, 200)
  })
})
