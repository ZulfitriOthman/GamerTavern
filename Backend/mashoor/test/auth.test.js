import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createLoginLimiter } from '../src/auth/loginLimiter.js'
import { APP_ORIGIN, Client, insertStaff, startTestServer } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const VENDOR_PASSWORD = 'VendorPass123!'

// Every admin endpoint, with a sample body for writes. Used for denial checks.
const ADMIN_ENDPOINTS = [
  ['GET', '/api/mashoor/admin/auth/me'],
  ['GET', '/api/mashoor/admin/vendors'],
  ['POST', '/api/mashoor/admin/vendors', { name: 'Sneaky Co' }],
  ['GET', '/api/mashoor/admin/vendors/1'],
  ['PATCH', '/api/mashoor/admin/vendors/1', { status: 'suspended' }],
  ['POST', '/api/mashoor/admin/vendors/1/users', { username: 'sneaky', name: 'X', password: 'SneakyPass123!' }],
  ['PATCH', '/api/mashoor/admin/vendor-users/1', { active: false }],
]

async function assertAdminDenied(client) {
  for (const [method, path, body] of ADMIN_ENDPOINTS) {
    const res = await client.request(method, path, { body })
    assert.equal(res.status, 401, `${method} ${path} should be 401, got ${res.status}`)
  }
}

describe('staff and vendor sessions', () => {
  let server
  let staff
  let companyA
  let companyB
  let alice

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Test Staff' })
    staff = new Client(server.baseUrl)
  })
  after(() => server.close())

  it('rejects a wrong staff password without setting a cookie', async () => {
    const res = await staff.post('/api/mashoor/admin/auth/login', { email: STAFF.email, password: 'wrong-password' })
    assert.equal(res.status, 401)
    assert.equal(res.setCookie.length, 0)
  })

  it('signs staff in with an httpOnly, SameSite=Strict cookie scoped to /api/mashoor/admin', async () => {
    const res = await staff.post('/api/mashoor/admin/auth/login', { email: 'STAFF@mashoor.test ', password: STAFF.password })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.email, STAFF.email)
    assert.equal(res.body.user.password_hash, undefined)
    const cookie = res.setCookie.find((c) => c.startsWith('mashoor_staff='))
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Strict/i)
    assert.match(cookie, /Path=\/api\/mashoor\/admin(;|$)/i)

    const me = await staff.get('/api/mashoor/admin/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, STAFF.email)
  })

  it('denies every admin endpoint to anonymous requests', async () => {
    await assertAdminDenied(new Client(server.baseUrl))
  })

  it('lets staff create vendor companies', async () => {
    const a = await staff.post('/api/mashoor/admin/vendors', { name: 'Vendor A Sdn Bhd', registrationNo: '201901000001' })
    assert.equal(a.status, 201)
    assert.equal(a.body.vendor.status, 'active')
    companyA = a.body.vendor

    const b = await staff.post('/api/mashoor/admin/vendors', { name: 'Vendor B Sdn Bhd' })
    assert.equal(b.status, 201)
    companyB = b.body.vendor

    const invalid = await staff.post('/api/mashoor/admin/vendors', { name: '   ' })
    assert.equal(invalid.status, 400)
  })

  it('lets staff link vendor accounts to a company', async () => {
    const res = await staff.post(`/api/mashoor/admin/vendors/${companyA.id}/users`, {
      username: 'alice',
      name: 'Alice',
      password: VENDOR_PASSWORD,
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.companyId, companyA.id)
    assert.equal(res.body.user.password_hash, undefined)
    alice = res.body.user

    await staff.post(`/api/mashoor/admin/vendors/${companyB.id}/users`, {
      username: 'bob',
      name: 'Bob',
      password: VENDOR_PASSWORD,
    })

    const detail = await staff.get(`/api/mashoor/admin/vendors/${companyA.id}`)
    assert.equal(detail.status, 200)
    assert.deepEqual(
      detail.body.users.map((u) => u.username),
      ['alice'],
    )

    const list = await staff.get('/api/mashoor/admin/vendors')
    assert.equal(list.body.vendors.find((v) => v.id === companyA.id).userCount, 1)
  })

  it('validates vendor accounts (duplicate username in any case, weak password, unknown company)', async () => {
    const dup = await staff.post(`/api/mashoor/admin/vendors/${companyB.id}/users`, {
      username: ' ALICE ',
      name: 'Alice again',
      password: VENDOR_PASSWORD,
    })
    assert.equal(dup.status, 409)

    const weak = await staff.post(`/api/mashoor/admin/vendors/${companyA.id}/users`, {
      username: 'weak',
      name: 'Weak',
      password: 'short',
    })
    assert.equal(weak.status, 400)

    const missing = await staff.post('/api/mashoor/admin/vendors/9999/users', {
      username: 'ghost',
      name: 'Ghost',
      password: VENDOR_PASSWORD,
    })
    assert.equal(missing.status, 404)
  })

  it('signs a vendor in and derives the company from the account', async () => {
    const vendor = new Client(server.baseUrl)
    const login = await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })
    assert.equal(login.status, 200)
    assert.match(
      login.setCookie.find((c) => c.startsWith('mashoor_vendor=')),
      /Path=\/api\/mashoor\/portal(;|$)/i,
    )

    const me = await vendor.get('/api/mashoor/portal/auth/me')
    assert.equal(me.status, 200)
    assert.deepEqual(me.body.company, { id: companyA.id, name: 'Vendor A Sdn Bhd' })

    // Query strings / bodies cannot change the company.
    const spoof = await vendor.get(`/api/mashoor/portal/auth/me?companyId=${companyB.id}`)
    assert.equal(spoof.body.company.id, companyA.id)
  })

  it('denies every admin endpoint to a signed-in vendor', async () => {
    const vendor = new Client(server.baseUrl)
    await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })
    await assertAdminDenied(vendor)

    // Even if the vendor token is replayed under the staff cookie name.
    const forged = new Client(server.baseUrl)
    forged.cookies.set('mashoor_staff', vendor.cookies.get('mashoor_vendor'))
    await assertAdminDenied(forged)

    // And the denied writes really did nothing.
    const list = await staff.get('/api/mashoor/admin/vendors')
    assert.equal(list.body.vendors.some((v) => v.name === 'Sneaky Co'), false)
    assert.equal(list.body.vendors.find((v) => v.id === 1).status, 'active')
  })

  it('does not accept a staff session on vendor endpoints', async () => {
    const res = await staff.get('/api/mashoor/portal/auth/me')
    assert.equal(res.status, 401)
    const forged = new Client(server.baseUrl)
    forged.cookies.set('mashoor_vendor', staff.cookies.get('mashoor_staff'))
    assert.equal((await forged.get('/api/mashoor/portal/auth/me')).status, 401)
  })

  it('cuts off a deactivated vendor account immediately', async () => {
    const vendor = new Client(server.baseUrl)
    await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })
    assert.equal((await vendor.get('/api/mashoor/portal/auth/me')).status, 200)

    assert.equal((await staff.patch(`/api/mashoor/admin/vendor-users/${alice.id}`, { active: false })).status, 200)
    assert.equal((await vendor.get('/api/mashoor/portal/auth/me')).status, 401)
    const relogin = await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })
    assert.equal(relogin.status, 401)

    // Reactivation needs a new password set by staff; a plain "active: true" is refused.
    const plain = await staff.patch(`/api/mashoor/admin/vendor-users/${alice.id}`, { active: true })
    assert.equal(plain.status, 400)
    const reactivated = await staff.post(`/api/mashoor/admin/vendor-users/${alice.id}/reactivate`, { password: 'ReactivatedPass1!' })
    assert.equal(reactivated.status, 200)
    assert.equal(
      (await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })).status,
      401,
      'the old password must not work after reactivation',
    )
    assert.equal((await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: 'ReactivatedPass1!' })).status, 200)
    // Restore the original password for the following tests.
    await vendor.post('/api/mashoor/portal/auth/change-password', { currentPassword: 'ReactivatedPass1!', newPassword: VENDOR_PASSWORD })
  })

  it('cuts off every account of a suspended company', async () => {
    const vendor = new Client(server.baseUrl)
    await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })

    await staff.patch(`/api/mashoor/admin/vendors/${companyA.id}`, { status: 'suspended' })
    assert.equal((await vendor.get('/api/mashoor/portal/auth/me')).status, 401)
    assert.equal(
      (await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })).status,
      401,
    )

    // Vendor B is unaffected.
    const bob = new Client(server.baseUrl)
    assert.equal(
      (await bob.post('/api/mashoor/portal/auth/login', { username: 'bob', password: VENDOR_PASSWORD })).status,
      200,
    )

    await staff.patch(`/api/mashoor/admin/vendors/${companyA.id}`, { status: 'active' })
  })

  it('invalidates sessions on password reset and on logout', async () => {
    const vendor = new Client(server.baseUrl)
    await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: VENDOR_PASSWORD })
    const oldToken = vendor.cookies.get('mashoor_vendor')

    await staff.patch(`/api/mashoor/admin/vendor-users/${alice.id}`, { password: 'NewVendorPass456!' })
    assert.equal((await vendor.get('/api/mashoor/portal/auth/me')).status, 401)

    await vendor.post('/api/mashoor/portal/auth/login', { username: 'alice', password: 'NewVendorPass456!' })
    const token = vendor.cookies.get('mashoor_vendor')
    assert.notEqual(token, oldToken)
    assert.equal((await vendor.post('/api/mashoor/portal/auth/logout')).status, 204)

    const replay = new Client(server.baseUrl)
    replay.cookies.set('mashoor_vendor', token)
    assert.equal((await replay.get('/api/mashoor/portal/auth/me')).status, 401)

    // Staff logout too.
    const staff2 = new Client(server.baseUrl)
    await staff2.post('/api/mashoor/admin/auth/login', STAFF)
    const staffToken = staff2.cookies.get('mashoor_staff')
    await staff2.post('/api/mashoor/admin/auth/logout')
    const staffReplay = new Client(server.baseUrl)
    staffReplay.cookies.set('mashoor_staff', staffToken)
    assert.equal((await staffReplay.get('/api/mashoor/admin/vendors')).status, 401)
  })

  it('lets a vendor change their own password and signs out other sessions', async () => {
    const laptop = new Client(server.baseUrl)
    const phone = new Client(server.baseUrl)
    const creds = { username: 'bob', password: VENDOR_PASSWORD }
    await laptop.post('/api/mashoor/portal/auth/login', creds)
    await phone.post('/api/mashoor/portal/auth/login', creds)

    const wrong = await laptop.post('/api/mashoor/portal/auth/change-password', {
      currentPassword: 'nope',
      newPassword: 'BobNewPass789!',
    })
    assert.equal(wrong.status, 400)

    const ok = await laptop.post('/api/mashoor/portal/auth/change-password', {
      currentPassword: VENDOR_PASSWORD,
      newPassword: 'BobNewPass789!',
    })
    assert.equal(ok.status, 204)
    assert.equal((await laptop.get('/api/mashoor/portal/auth/me')).status, 200)
    assert.equal((await phone.get('/api/mashoor/portal/auth/me')).status, 401)
  })

  it('rejects state-changing requests from unknown browser origins', async () => {
    const evil = await staff.post('/api/mashoor/admin/vendors', { name: 'CSRF Co' }, { headers: { origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    const good = await staff.post('/api/mashoor/admin/vendors', { name: 'Vendor C Sdn Bhd' }, { headers: { origin: APP_ORIGIN } })
    assert.equal(good.status, 201)
  })

  it('returns 404 (not 500) for malformed ids', async () => {
    assert.equal((await staff.get('/api/mashoor/admin/vendors/abc')).status, 404)
    assert.equal((await staff.patch('/api/mashoor/admin/vendor-users/-1', { active: false })).status, 404)
  })
})

describe('login rate limiting', () => {
  let server
  before(async () => {
    server = await startTestServer({ limiter: createLoginLimiter({ maxFailures: 3 }) })
    await insertStaff(server.db, STAFF)
  })
  after(() => server.close())

  it('blocks after repeated failures, even with the right password', async () => {
    const client = new Client(server.baseUrl)
    for (let i = 0; i < 3; i++) {
      assert.equal((await client.post('/api/mashoor/admin/auth/login', { ...STAFF, password: 'wrong-password' })).status, 401)
    }
    assert.equal((await client.post('/api/mashoor/admin/auth/login', STAFF)).status, 429)
  })
})
