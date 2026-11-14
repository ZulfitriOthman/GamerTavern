// Username-based vendor accounts over real HTTP sessions. Password changes are
// voluntary: admin-given passwords (create, reset, reactivate) work immediately
// and stay valid until staff or the vendor change them.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createLoginLimiter } from '../src/auth/loginLimiter.js'
import { hashPassword } from '../src/auth/passwords.js'
import { Client, insertStaff, startTestServer, TINY_PNG } from './helpers.js'

const STAFF = { email: 'staff@mashoor.test', password: 'StaffPass123!' }
const INITIAL = 'Initial-Pass-2026'
const OWN = 'Vendors-Own-Pass-2026'
const REACTIVATION = 'Reactivation-Pass-1'
const RESET = 'Admin-Reset-Pass-22'

describe('vendor account lifecycle (username + password, optional password change)', () => {
  let server
  let staff
  let vendorId
  let userId
  let listingId
  let deskListingId
  let chairs
  let session // the vendor's browser

  const catalogStatuses = async (client) => [
    (await client.get('/api/mashoor/portal/listings')).status,
    (await client.get(`/api/mashoor/portal/listings/${listingId}`)).status,
    (await client.raw(`/api/mashoor/portal/listings/${listingId}/image`)).status,
    (await client.get('/api/mashoor/portal/categories')).status,
  ]
  const login = (client, username, password) => client.post('/api/mashoor/portal/auth/login', { username, password })
  const changePassword = (client, currentPassword, newPassword) =>
    client.post('/api/mashoor/portal/auth/change-password', { currentPassword, newPassword })

  before(async () => {
    server = await startTestServer()
    await insertStaff(server.db, { ...STAFF, name: 'Test Staff' })
    staff = new Client(server.baseUrl)
    assert.equal((await staff.post('/api/mashoor/admin/auth/login', STAFF)).status, 200)
    chairs = (await staff.post('/api/mashoor/admin/categories', { name: 'Chairs' })).body.category.id
    const desks = (await staff.post('/api/mashoor/admin/categories', { name: 'Desks' })).body.category.id
    listingId = (await staff.post('/api/mashoor/admin/listings', { title: 'Chair', categoryId: chairs, status: 'published' })).body.listing.id
    deskListingId = (await staff.post('/api/mashoor/admin/listings', { title: 'Desk', categoryId: desks, status: 'published' })).body.listing.id
    await staff.upload(`/api/mashoor/admin/listings/${listingId}/image`, TINY_PNG)
  })
  after(() => server.close())

  it('admin creates a vendor without any email', async () => {
    const res = await staff.post('/api/mashoor/admin/vendors', {
      name: 'Lifecycle Co',
      registrationNo: 'REG-1',
      account: { name: 'Lee', username: 'LeeVendor', password: INITIAL, confirmPassword: INITIAL },
    })
    assert.equal(res.status, 201)
    vendorId = res.body.vendor.id
    userId = res.body.user.id
    assert.equal(res.body.user.username, 'leevendor')
    assert.equal(res.body.user.email, undefined)
    assert.equal(res.body.user.mustChangePassword, undefined)
    await staff.put(`/api/mashoor/admin/vendors/${vendorId}/categories`, { categoryIds: [chairs] })
  })

  it('signs in with the admin-given password and reaches the catalog immediately', async () => {
    session = new Client(server.baseUrl)
    assert.equal((await login(session, 'leevendor', 'wrong-password-1')).status, 401)
    const res = await login(session, '  LEEVENDOR ', INITIAL)
    assert.equal(res.status, 200)
    assert.equal(res.body.user.username, 'leevendor')
    assert.equal(res.body.mustChangePassword, undefined)
    assert.deepEqual(await catalogStatuses(session), [200, 200, 200, 200])
    const list = await session.get('/api/mashoor/portal/listings')
    assert.deepEqual(list.body.listings.map((l) => l.title), ['Chair'])
  })

  it('still enforces category access', async () => {
    assert.equal((await session.get(`/api/mashoor/portal/listings/${deskListingId}`)).status, 404)
    assert.deepEqual((await session.get('/api/mashoor/portal/listings?q=Desk')).body.listings, [])
  })

  it('the admin-given password keeps working across sign-ins until it is changed', async () => {
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', INITIAL)).status, 200)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', INITIAL)).status, 200)
  })

  it('rejects a voluntary change with a wrong current password, then rate-limits guessing', async () => {
    const wrong = await changePassword(session, 'not-my-password', OWN)
    assert.equal(wrong.status, 400)
    assert.equal(wrong.body.error, 'Current password is incorrect.')
    assert.equal((await changePassword(session, INITIAL, 'short')).status, 400)
    assert.equal((await changePassword(session, INITIAL, INITIAL)).status, 400)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', INITIAL)).status, 200, 'unchanged')
  })

  it('a voluntary change: old password fails, new works, other sessions end, this one is renewed', async () => {
    const otherDevice = new Client(server.baseUrl)
    await login(otherDevice, 'leevendor', INITIAL)
    const oldCookie = session.cookies.get('mashoor_vendor')

    const res = await changePassword(session, INITIAL, OWN)
    assert.equal(res.status, 204)
    const renewed = res.setCookie.find((c) => c.startsWith('mashoor_vendor='))
    assert.ok(renewed && /HttpOnly/i.test(renewed) && /SameSite=Strict/i.test(renewed), 'a fresh session cookie is issued')
    assert.notEqual(session.cookies.get('mashoor_vendor'), oldCookie)

    assert.equal((await session.get('/api/mashoor/portal/listings')).status, 200, 'this browser stays signed in')
    assert.equal((await otherDevice.get('/api/mashoor/portal/auth/me')).status, 401, 'other devices are signed out')
    const stale = new Client(server.baseUrl)
    stale.cookies.set('mashoor_vendor', oldCookie)
    assert.equal((await stale.get('/api/mashoor/portal/auth/me')).status, 401, 'the pre-change token is dead')
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', INITIAL)).status, 401)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', OWN)).status, 200)
  })

  it('deactivation keeps the account but ends sessions and blocks logins', async () => {
    const res = await staff.patch(`/api/mashoor/admin/vendor-users/${userId}`, { active: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.active, false)
    assert.deepEqual(await catalogStatuses(session), [401, 401, 401, 401])
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', OWN)).status, 401)

    const detail = await staff.get(`/api/mashoor/admin/vendors/${vendorId}`)
    assert.deepEqual(detail.body.users.map((u) => [u.username, u.active]), [['leevendor', false]])
    assert.deepEqual(detail.body.categories.map((c) => c.id), [chairs])
    assert.equal(server.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_type = ? AND user_id = ?').get('vendor', userId).n, 0)
  })

  it('an admin password reset does not reactivate an inactive account', async () => {
    const reset = await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reset-password`, { password: RESET })
    assert.equal(reset.status, 200)
    assert.equal(reset.body.user.active, false)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', RESET)).status, 401)
  })

  it('reactivation requires staff to set a confirmed new password', async () => {
    assert.equal((await staff.patch(`/api/mashoor/admin/vendor-users/${userId}`, { active: true })).status, 400)
    assert.equal((await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reactivate`, {})).status, 400)
    const mismatch = await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reactivate`, {
      password: REACTIVATION,
      confirmPassword: 'Something-Else-1',
    })
    assert.equal(mismatch.status, 400)
    const res = await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reactivate`, {
      password: REACTIVATION,
      confirmPassword: REACTIVATION,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.active, true)
    assert.equal(res.body.user.username, 'leevendor', 'same account, same username')
    assert.equal((await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reactivate`, { password: REACTIVATION })).status, 409)
  })

  it('after reactivation: old passwords and sessions stay dead, the new one gives immediate access', async () => {
    assert.equal((await session.get('/api/mashoor/portal/auth/me')).status, 401, 'old session stays dead')
    for (const old of [INITIAL, OWN, RESET]) {
      assert.equal((await login(new Client(server.baseUrl), 'leevendor', old)).status, 401, old)
    }
    session = new Client(server.baseUrl)
    assert.equal((await login(session, 'leevendor', REACTIVATION)).status, 200)
    assert.deepEqual(await catalogStatuses(session), [200, 200, 200, 200], 'categories and catalog access are intact')
  })

  it('admin resets a forgotten password: sessions revoked, new password works immediately', async () => {
    const reset = await staff.post(`/api/mashoor/admin/vendor-users/${userId}/reset-password`, {
      password: 'Forgotten-Reset-77',
      confirmPassword: 'Forgotten-Reset-77',
    })
    assert.equal(reset.status, 200)
    assert.equal(reset.body.user.active, true)
    assert.equal((await session.get('/api/mashoor/portal/auth/me')).status, 401)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', REACTIVATION)).status, 401)
    const fresh = new Client(server.baseUrl)
    assert.equal((await login(fresh, 'leevendor', 'Forgotten-Reset-77')).status, 200)
    assert.deepEqual(await catalogStatuses(fresh), [200, 200, 200, 200])
  })

  it('has no unauthenticated or vendor-reachable password reset', async () => {
    const anon = new Client(server.baseUrl)
    // No such routes exist: the anonymous request stops at the portal's sign-in wall.
    for (const path of ['/api/mashoor/portal/auth/reset-password', '/api/mashoor/portal/auth/forgot-password']) {
      const res = await anon.post(path, { username: 'leevendor', password: 'Hijack-Pass-123', newPassword: 'Hijack-Pass-123' })
      assert.ok([401, 404].includes(res.status), `${path} → ${res.status}`)
    }
    assert.equal((await anon.post('/api/mashoor/portal/auth/change-password', { currentPassword: 'x', newPassword: 'Hijack-Pass-123' })).status, 401)
    assert.equal((await anon.post(`/api/mashoor/admin/vendor-users/${userId}/reset-password`, { password: 'Hijack-Pass-123' })).status, 401)
    const vendor = new Client(server.baseUrl)
    await login(vendor, 'leevendor', 'Forgotten-Reset-77')
    for (const [method, path, body] of [
      ['POST', `/api/mashoor/admin/vendor-users/${userId}/reset-password`, { password: 'Hijack-Pass-123' }],
      ['POST', `/api/mashoor/admin/vendor-users/${userId}/reactivate`, { password: 'Hijack-Pass-123' }],
      ['PATCH', `/api/mashoor/admin/vendor-users/${userId}`, { active: false }],
    ]) {
      assert.equal((await vendor.request(method, path, { body })).status, 401, path)
    }
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', 'Hijack-Pass-123')).status, 401)
    assert.equal((await login(new Client(server.baseUrl), 'leevendor', 'Forgotten-Reset-77')).status, 200, 'password unchanged')
  })

  it('never returns or logs password data', async () => {
    const all = JSON.stringify([
      (await staff.get('/api/mashoor/admin/vendors')).body,
      (await staff.get(`/api/mashoor/admin/vendors/${vendorId}`)).body,
    ])
    assert.equal(/password_hash|scrypt\$|must_change/.test(all), false)
    const audit = JSON.stringify(server.db.prepare('SELECT * FROM audit_log').all())
    for (const secret of [INITIAL, OWN, REACTIVATION, RESET, 'Forgotten-Reset-77']) {
      assert.equal(audit.includes(secret), false, 'no password in the audit log')
    }
  })

  it('a leftover must-change flag (from before migration 0004) no longer restricts anything', async () => {
    server.db.prepare('UPDATE vendor_users SET must_change_password = 1 WHERE id = ?').run(userId)
    const client = new Client(server.baseUrl)
    assert.equal((await login(client, 'leevendor', 'Forgotten-Reset-77')).status, 200)
    assert.deepEqual(await catalogStatuses(client), [200, 200, 200, 200])
  })

  it('an account without a username (created before migration 0003) can only sign in once staff set one', async () => {
    const legacyId = Number(
      server.db
        .prepare("INSERT INTO vendor_users (company_id, email, name, password_hash) VALUES (?, 'old@example.test', 'Old', ?)")
        .run(vendorId, await hashPassword('Legacy-Pass-2026')).lastInsertRowid,
    )
    assert.equal((await login(new Client(server.baseUrl), 'old@example.test', 'Legacy-Pass-2026')).status, 401)
    assert.equal((await staff.patch(`/api/mashoor/admin/vendor-users/${legacyId}`, { username: 'LeeVendor' })).status, 409)
    assert.equal((await staff.patch(`/api/mashoor/admin/vendor-users/${legacyId}`, { username: 'old-account' })).status, 200)
    assert.equal((await login(new Client(server.baseUrl), 'old-account', 'Legacy-Pass-2026')).status, 200)
  })

  it('admin authentication is unchanged (email + password)', async () => {
    const admin = new Client(server.baseUrl)
    assert.equal((await admin.post('/api/mashoor/admin/auth/login', { username: 'staff', password: STAFF.password })).status, 401)
    assert.equal((await admin.post('/api/mashoor/admin/auth/login', STAFF)).status, 200)
    assert.equal((await admin.get('/api/mashoor/admin/dashboard')).status, 200)
  })
})

describe('vendor rate limiting', () => {
  async function setup() {
    const server = await startTestServer({ limiter: createLoginLimiter({ maxFailures: 3 }) })
    await insertStaff(server.db, { ...STAFF, name: 'S' })
    const staff = new Client(server.baseUrl)
    await staff.post('/api/mashoor/admin/auth/login', STAFF)
    await staff.post('/api/mashoor/admin/vendors', { name: 'RL', account: { name: 'R', username: 'ratelimited', password: INITIAL } })
    return server
  }

  it('blocks sign-in after repeated failures, even with the right password', async () => {
    const server = await setup()
    try {
      const client = new Client(server.baseUrl)
      for (let i = 0; i < 3; i++) {
        assert.equal((await client.post('/api/mashoor/portal/auth/login', { username: 'RateLimited', password: 'wrong-pass-1' })).status, 401)
      }
      assert.equal((await client.post('/api/mashoor/portal/auth/login', { username: 'ratelimited', password: INITIAL })).status, 429)
    } finally {
      await server.close()
    }
  })

  it('blocks current-password guessing on the change-password form', async () => {
    const server = await setup()
    try {
      const client = new Client(server.baseUrl)
      await client.post('/api/mashoor/portal/auth/login', { username: 'ratelimited', password: INITIAL })
      for (let i = 0; i < 3; i++) {
        const res = await client.post('/api/mashoor/portal/auth/change-password', { currentPassword: `guess-${i}-xxxxx`, newPassword: OWN })
        assert.equal(res.status, 400)
      }
      const blocked = await client.post('/api/mashoor/portal/auth/change-password', { currentPassword: INITIAL, newPassword: OWN })
      assert.equal(blocked.status, 429)
      assert.equal((await new Client(server.baseUrl).post('/api/mashoor/portal/auth/login', { username: 'ratelimited', password: INITIAL })).status, 200)
    } finally {
      await server.close()
    }
  })
})
