import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import sharp from 'sharp'
import { client, setup, testDbConfigured } from './helpers.js'

const skip = testDbConfigured ? false : 'set TEST_MYSQL_* to run MySQL integration tests (see tests/helpers.js)'

describe('wedding API (MySQL integration)', { skip }, () => {
  let env
  let guest
  let adminClient
  const ADMIN = { email: 'admin@example.test', password: 'correct horse battery staple' }

  before(async () => {
    env = await setup()
    guest = client(env.base)
    adminClient = client(env.base)
    const { createAdmin } = await import('../src/services/auth.js')
    await createAdmin(env.db, { ...ADMIN, displayName: 'Test Admin' })
  })
  after(async () => env?.teardown())

  const login = async (c = adminClient) => {
    const r = await c.post('/api/auth/login', { json: ADMIN, ip: '10.0.9.1' })
    assert.equal(r.status, 200)
    return r
  }

  // ------------------------------------------------------------------ seed
  describe('seeded wedding information', () => {
    it('serves the official invitation details', async () => {
      const { status, data } = await guest.get('/api/public/site')
      assert.equal(status, 200)
      const { settings, events, albums } = data
      assert.equal(settings.wedding_date, '2027-01-01')
      assert.equal(settings.wedding_time, '13:30:00')
      assert.equal(settings.timezone, 'Asia/Brunei')
      assert.equal(settings.content.couple.fullNameOne, 'Awang Muhammad Zulfitri Bin Othman')
      assert.equal(settings.content.couple.fullNameTwo, 'Dayang Siti Mariah Binti Abdullah @ Md Yusof')
      assert.equal(settings.content.hijriDate, '22 Rejab 1448')
      assert.equal(settings.content.invitation.bismillah, 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')
      assert.deepEqual(
        settings.content.invitation.familyGroups.map((g) => [g.title, g.members.split('\n').length]),
        [
          ['Keluarga Pengantin Lelaki', 7],
          ['Keluarga Pengantin Perempuan', 6],
        ],
      )
      assert.equal(
        settings.content.invitation.familyGroups[0].members,
        'Awg Othman Bin Haji Ismail\nDyg Noorhana Binti Haji Abd Rahman (Isteri)\nAwg Abd Hamid Bin Othman\nDyg Amal Saleha Binti Othman\nAwg Md Nur Aminuddin Bin Othman\nDyg Nurani Binti Othman\nAwg Ahmad Amirudin Bin Othman',
      )
      assert.equal(
        settings.content.invitation.familyGroups[1].members,
        'Awg Mohd Yusof Bin Haji Mohd Daud\nDyg Nur Qisthina Binti Abdul Rahman(Isteri)\nAwg Mohd Hidayat Bin Mohd Yusof\nDyg Hayati Binti Mohd Yusof\nAwg Mohd Syafie’e Bin Mohd Yusof\nDyg Siti Nur Aisyah Binti Mohd Yusof',
      )
      assert.equal(events.length, 1)
      assert.equal(events[0].title, 'Majlis Bersanding')
      assert.equal(events[0].venue_name, 'Masjid Suri Seri Begawan Raja Pengiran Anak Damit')
      assert.equal(events[0].end_time, null)
      assert.deepEqual(
        events[0].programme.map((p) => [p.time, p.endTime, p.title]),
        [
          ['13:30', '14:15', 'Menerima Jemputan'],
          ['14:30', '', 'Majlis Menghantar Berian Dan Mas Kahwin'],
          ['', '', 'Majlis Akad Nikah'],
          ['', '', 'Bersanding'],
          ['', '', 'Membaca Doa Selamat'],
          ['', '', 'Menikmati Jamuan'],
        ],
      )
      assert.equal(albums.length, 4)
      assert.equal(typeof settings.greetings_enabled, 'boolean')
    })
  })

  // ------------------------------------------------------------------ auth
  describe('admin authentication & authorisation', () => {
    it('rejects admin API calls without a session', async () => {
      for (const url of ['/api/admin/stats', '/api/admin/guests', '/api/admin/rsvps', '/api/admin/photos']) {
        assert.equal((await guest.get(url)).status, 401, url)
      }
      assert.equal((await guest.put('/api/admin/settings', { json: {} })).status, 401)
    })

    it('rejects wrong passwords and unknown emails identically', async () => {
      const a = await guest.post('/api/auth/login', { json: { email: ADMIN.email, password: 'wrong' }, ip: '10.0.8.1' })
      const b = await guest.post('/api/auth/login', { json: { email: 'nobody@example.test', password: 'wrong' }, ip: '10.0.8.1' })
      assert.equal(a.status, 401)
      assert.deepEqual(a.data, b.data)
    })

    it('rate-limits login attempts per email', async () => {
      const c = client(env.base)
      const email = 'target@example.test'
      for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { json: { email, password: 'x' }, ip: `10.0.7.${i}` })
      const r = await c.post('/api/auth/login', { json: { email, password: 'x' }, ip: '10.0.7.99' })
      assert.equal(r.status, 429)
    })

    it('issues an HttpOnly, SameSite session cookie and restores the session', async () => {
      const r = await login()
      const setCookie = r.headers.get('set-cookie')
      assert.match(setCookie, /wedding_admin=/)
      assert.match(setCookie, /HttpOnly/i)
      assert.match(setCookie, /SameSite=Lax/i)
      assert.match(setCookie, /Path=\/api/)
      assert.equal(r.data.admin.email, ADMIN.email)
      assert.equal(r.data.admin.password_hash, undefined)
      const s = await adminClient.get('/api/auth/session')
      assert.equal(s.data.admin.email, ADMIN.email)
      assert.match(s.data.csrfToken, /^[0-9a-f]{64}$/)
      const [rows] = await env.db.query('SELECT id FROM wedding_admin_sessions')
      assert.ok(rows.every((x) => !adminClient.cookie.includes(x.id)), 'only the hash of the session token is stored')
    })

    it('requires the CSRF token for state-changing admin requests', async () => {
      const r = await adminClient.post('/api/admin/guests', { json: { guests: [{ name: 'X', max_party_size: 1 }] }, headers: { 'x-csrf-token': 'nope' } })
      assert.equal(r.status, 403)
      assert.equal((await adminClient.get('/api/admin/stats')).status, 200)
    })

    it('logout invalidates the session server-side', async () => {
      const c = client(env.base)
      await login(c)
      const stolenCookie = c.cookie
      await c.post('/api/auth/logout')
      const r = await fetch(`${env.base}/api/admin/stats`, { headers: { cookie: stolenCookie } })
      assert.equal(r.status, 401)
    })

    it('blocks state-changing requests from disallowed origins; allows configured ones', async () => {
      const bad = await guest.post('/api/public/greetings', { json: { name: 'A', message: 'Hello' }, headers: { origin: 'https://evil.test' } })
      assert.equal(bad.status, 403)
      const pre = await guest.raw('OPTIONS', '/api/public/greetings', { headers: { origin: 'http://allowed.test', 'access-control-request-method': 'POST' } })
      assert.equal(pre.status, 204)
      assert.equal(pre.headers.get('access-control-allow-origin'), 'http://allowed.test')
      assert.equal(pre.headers.get('access-control-allow-credentials'), 'true')
    })
  })

  // ------------------------------------------------------------------ greetings
  describe('guestbook', () => {
    it('publishes a wish immediately — no approval, no login', async () => {
      const r = await client(env.base).post('/api/public/greetings', { json: { name: 'Sam', message: 'Tahniah! Selamat pengantin baru.', relationship: 'Friend' }, ip: '10.1.0.1' })
      assert.equal(r.status, 201)
      assert.equal(r.data.status, 'published')
      assert.equal(r.data.item.name, 'Sam')
      assert.equal(r.data.item.relationship, 'Friend')
      assert.ok(r.data.item.created_at)
      const [[row]] = await env.db.query('SELECT status FROM wedding_greetings WHERE id = ?', [r.data.item.id])
      assert.equal(row.status, 'approved', 'stored as publicly visible')
      // visible to anyone (fresh client = another browser), moderation fields not exposed
      const pub = await client(env.base).get('/api/public/greetings')
      assert.deepEqual(pub.data.items.map((w) => w.id), [r.data.item.id])
      assert.equal(pub.data.items[0].status, undefined)

      const dup = await guest.post('/api/public/greetings', { json: { name: ' sam ', message: 'Tahniah!   Selamat pengantin baru.' }, ip: '10.1.0.2' })
      assert.equal(dup.data.status, 'duplicate')
      assert.equal((await guest.get('/api/public/greetings')).data.items.length, 1, 'no duplicate shown')
    })

    it('publishes several different wishes, newest first, without duplicates', async () => {
      for (const [i, name] of ['Aminah', 'Hafiz', 'Nurul'].entries()) {
        await guest.post('/api/public/greetings', { json: { name, message: `Selamat pengantin baru ${i}` }, ip: `10.1.4.${i}` })
      }
      const items = (await guest.get('/api/public/greetings')).data.items
      assert.deepEqual(items.slice(0, 3).map((w) => w.name), ['Nurul', 'Hafiz', 'Aminah'])
      assert.equal(new Set(items.map((w) => w.id)).size, items.length)
    })

    it('returns only the latest N wishes when a limit is given (homepage wall)', async () => {
      const r = await guest.get('/api/public/greetings?limit=2')
      assert.equal(r.data.items.length, 2)
      assert.equal(r.data.hasMore, true)
      const all = (await guest.get('/api/public/greetings')).data.items
      assert.deepEqual(r.data.items.map((w) => w.id), all.slice(0, 2).map((w) => w.id), 'same newest-first order')
      assert.ok((await guest.get('/api/public/greetings?limit=999')).data.items.length <= 24, 'limit is capped')
      assert.equal((await guest.get('/api/public/greetings?limit=abc')).status, 200)
    })

    it('ignores any status a guest tries to set', async () => {
      const r = await guest.post('/api/public/greetings', { json: { name: 'Sneaky', message: 'Hello there', status: 'hidden', content_hash: 'x' }, ip: '10.1.5.1' })
      const [[row]] = await env.db.query('SELECT status, content_hash FROM wedding_greetings WHERE id = ?', [r.data.item.id])
      assert.equal(row.status, 'approved')
      assert.notEqual(row.content_hash, 'x')
    })

    it('admin can hide, mark as spam and delete published wishes', async () => {
      const id = (await guest.post('/api/public/greetings', { json: { name: 'Spammer', message: 'Inappropriate text' }, ip: '10.1.5.2' })).data.item.id
      const visible = async () => (await guest.get('/api/public/greetings')).data.items.some((w) => w.id === id)
      assert.equal(await visible(), true)
      await adminClient.patch(`/api/admin/greetings/${id}`, { json: { status: 'hidden' } })
      assert.equal(await visible(), false)
      await adminClient.patch(`/api/admin/greetings/${id}`, { json: { status: 'spam' } })
      assert.equal(await visible(), false)
      assert.equal((await adminClient.del(`/api/admin/greetings/${id}`)).status, 200)
      const [rows] = await env.db.query('SELECT id FROM wedding_greetings WHERE id = ?', [id])
      assert.equal(rows.length, 0)
    })

    it('leaves wishes from the old approval workflow unchanged', async () => {
      await env.db.query(
        "INSERT INTO wedding_greetings (id, name, message, status, content_hash) VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'Old', 'Old pending wish', 'pending', 'old-hash')",
      )
      await guest.post('/api/public/greetings', { json: { name: 'New', message: 'A brand new wish' }, ip: '10.1.5.3' })
      const [[old]] = await env.db.query("SELECT status FROM wedding_greetings WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b'")
      assert.equal(old.status, 'pending')
      assert.ok(!(await guest.get('/api/public/greetings')).data.items.some((w) => w.name === 'Old'))
    })

    it('rejects keyboard-mash floods', async () => {
      const r = await guest.post('/api/public/greetings', { json: { name: 'X', message: 'a'.repeat(30) }, ip: '10.1.5.4' })
      assert.equal(r.status, 400)
      assert.match(r.data.message, /repeated characters/)
    })

    it('validates input and never echoes database errors', async () => {
      const cases = [
        [{ name: '', message: 'hello' }, /name/],
        [{ name: 'A', message: 'x'.repeat(1001) }, /1000/],
        [{ name: 'A', message: 'see http://a.x http://b.x http://c.x' }, /links/],
      ]
      for (const [json, re] of cases) {
        const r = await guest.post('/api/public/greetings', { json, ip: '10.1.1.1' })
        assert.equal(r.status, 400)
        assert.match(r.data.message, re)
      }
      const bad = await guest.raw('POST', '/api/public/greetings', { headers: { 'content-type': 'application/json' }, form: '{oops' })
      assert.equal(bad.status, 400)
      assert.doesNotMatch(await bad.text(), /SyntaxError|at JSON|stack/i)
    })

    it('honeypot submissions are silently discarded', async () => {
      const before = (await env.db.query('SELECT COUNT(*) n FROM wedding_greetings'))[0][0].n
      const r = await guest.post('/api/public/greetings', { json: { name: 'Bot', message: 'Buy now', website: 'http://spam' }, ip: '10.1.2.1' })
      assert.equal(r.status, 201)
      assert.equal((await env.db.query('SELECT COUNT(*) n FROM wedding_greetings'))[0][0].n, before)
    })

    it('rate-limits greetings per IP (5 per 30 minutes)', async () => {
      for (let i = 0; i < 5; i++) {
        assert.equal((await guest.post('/api/public/greetings', { json: { name: 'Rate', message: `Message ${i}` }, ip: '10.1.3.1' })).status, 201)
      }
      assert.equal((await guest.post('/api/public/greetings', { json: { name: 'Rate', message: 'Message 6' }, ip: '10.1.3.1' })).status, 429)
      assert.equal((await guest.post('/api/public/greetings', { json: { name: 'Other', message: 'Different guest' }, ip: '10.1.3.2' })).status, 201)
    })
  })

  // ------------------------------------------------------------------ RSVP
  describe('RSVP', () => {
    let majlis
    let token

    before(async () => {
      majlis = (await guest.get('/api/public/site')).data.events[0]
      const ev = await adminClient.post('/api/admin/events', {
        json: { title: 'Small Dinner', event_date: '2027-01-02', capacity: 3, max_party_size: 2, rsvp_enabled: true, is_published: true },
      })
      assert.equal(ev.status, 201)
      env.dinner = ev.data.event
    })

    it('saves an open RSVP and keeps it private', async () => {
      const r = await guest.post('/api/public/rsvps', {
        json: { name: 'Open Guest', email: 'Open@Example.com', responses: [{ event_id: majlis.id, attending: true, party_size: 2 }] },
        ip: '10.2.0.1',
      })
      assert.equal(r.status, 201)
      assert.deepEqual(r.data, { success: true, status: 'saved', events: 1 })
      assert.equal((await guest.get('/api/admin/rsvps')).status, 401)
    })

    it('prevents a duplicate open RSVP from overwriting the original', async () => {
      const r = await guest.post('/api/public/rsvps', {
        json: { name: 'Impostor', email: 'OPEN@example.com', responses: [{ event_id: majlis.id, attending: false }] },
        ip: '10.2.0.2',
      })
      assert.equal(r.data.status, 'duplicate')
      const [[row]] = await env.db.query('SELECT name, attending FROM wedding_rsvps WHERE email = ?', ['open@example.com'])
      assert.deepEqual({ ...row }, { name: 'Open Guest', attending: true })
    })

    it('enforces party size limits and event capacity', async () => {
      const over = await guest.post('/api/public/rsvps', { json: { name: 'Big', email: 'big@example.com', responses: [{ event_id: majlis.id, attending: true, party_size: 5 }] }, ip: '10.2.1.1' })
      assert.equal(over.status, 400)
      assert.match(over.data.message, /up to 4/)
      await guest.post('/api/public/rsvps', { json: { name: 'Two', email: 'two@example.com', responses: [{ event_id: env.dinner.id, attending: true, party_size: 2 }] }, ip: '10.2.1.2' })
      const full = await guest.post('/api/public/rsvps', { json: { name: 'Late', email: 'late@example.com', responses: [{ event_id: env.dinner.id, attending: true, party_size: 2 }] }, ip: '10.2.1.3' })
      assert.equal(full.status, 409)
      assert.match(full.data.message, /capacity/)
      const decline = await guest.post('/api/public/rsvps', { json: { name: 'Late', email: 'late@example.com', responses: [{ event_id: env.dinner.id, attending: false }] }, ip: '10.2.1.3' })
      assert.equal(decline.data.status, 'saved')
    })

    it('rejects invalid events and unpublished events', async () => {
      const hidden = await adminClient.post('/api/admin/events', { json: { title: 'Private', max_party_size: 2, rsvp_enabled: true, is_published: false } })
      for (const event_id of ['not-a-uuid', hidden.data.event.id]) {
        const r = await guest.post('/api/public/rsvps', { json: { name: 'X', email: `x${event_id.length}@example.com`, responses: [{ event_id, attending: true, party_size: 1 }] }, ip: '10.2.2.1' })
        assert.equal(r.status, 400)
      }
    })

    it('creates guests with hashed one-time invitation tokens', async () => {
      const r = await adminClient.post('/api/admin/guests', { json: { guests: [{ name: 'Keluarga Contoh', max_party_size: 3 }] } })
      assert.equal(r.status, 201)
      token = r.data.created[0].token
      assert.match(token, /^[A-Za-z0-9_-]{32}$/)
      const [[row]] = await env.db.query('SELECT invite_token_hash FROM wedding_guests WHERE name = ?', ['Keluarga Contoh'])
      assert.notEqual(row.invite_token_hash, token)
      assert.match(row.invite_token_hash, /^[0-9a-f]{64}$/)
      const list = await adminClient.get('/api/admin/guests')
      assert.ok(!JSON.stringify(list.data).includes(token), 'token never returned again')
      assert.ok(!JSON.stringify(list.data).includes(row.invite_token_hash), 'hash never exposed')
    })

    it('invitation link: lookup, limit, update in place', async () => {
      const inv = await guest.get(`/api/public/invitations/${token}`)
      assert.equal(inv.data.invitation.name, 'Keluarga Contoh')
      assert.equal(inv.data.invitation.id, undefined)
      assert.equal((await guest.get('/api/public/invitations/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).status, 404)

      const tooMany = await guest.post('/api/public/rsvps', { json: { token, responses: [{ event_id: majlis.id, attending: true, party_size: 4 }] }, ip: '10.2.3.1' })
      assert.match(tooMany.data.message, /up to 3/)
      await guest.post('/api/public/rsvps', { json: { token, responses: [{ event_id: majlis.id, attending: true, party_size: 3 }] }, ip: '10.2.3.1' })
      const upd = await guest.post('/api/public/rsvps', { json: { token, responses: [{ event_id: majlis.id, attending: false }], message: 'Maaf' }, ip: '10.2.3.1' })
      assert.equal(upd.data.status, 'saved')
      const after = (await guest.get(`/api/public/invitations/${token}`)).data.invitation.responses
      assert.equal(after.length, 1, 'updated in place, not duplicated')
      assert.equal(after[0].attending, false)
      assert.equal(after[0].message, 'Maaf')
    })

    it('regenerating a link invalidates the old one', async () => {
      const guests = (await adminClient.get('/api/admin/guests')).data.guests
      const g = guests.find((x) => x.name === 'Keluarga Contoh')
      const fresh = await adminClient.post(`/api/admin/guests/${g.id}/invite-link`)
      assert.equal((await guest.get(`/api/public/invitations/${token}`)).status, 404)
      assert.equal((await guest.get(`/api/public/invitations/${fresh.data.token}`)).status, 200)
      token = fresh.data.token
    })

    it('honours invite-only mode, closed mode and the deadline', async () => {
      const settings = (await adminClient.get('/api/admin/settings')).data.settings
      const save = (patch) => adminClient.put('/api/admin/settings', { json: { ...settings, ...patch } })
      const open = (ip) => guest.post('/api/public/rsvps', { json: { name: 'Q', email: `q${ip}@example.com`, responses: [{ event_id: majlis.id, attending: false }] }, ip })

      assert.equal((await save({ rsvp_mode: 'invite_only' })).status, 200)
      assert.match((await open('10.2.4.1')).data.message, /personal RSVP link/)
      assert.equal((await guest.post('/api/public/rsvps', { json: { token, responses: [{ event_id: majlis.id, attending: false }] }, ip: '10.2.4.1' })).data.status, 'saved')

      await save({ rsvp_mode: 'closed' })
      assert.equal((await open('10.2.4.2')).status, 403)

      await save({ rsvp_mode: 'open', rsvp_deadline: '2020-01-01' })
      assert.match((await open('10.2.4.3')).data.message, /deadline has passed/)
      await save({ rsvp_mode: 'open', rsvp_deadline: null })
    })

    it('rate-limits RSVPs per IP', async () => {
      let last
      for (let i = 0; i < 11; i++) last = await guest.post('/api/public/rsvps', { json: { name: `R${i}`, email: `r${i}@example.com`, responses: [{ event_id: majlis.id, attending: false }] }, ip: '10.2.5.1' })
      assert.equal(last.status, 429)
    })

    it('admin can list, edit and delete RSVPs; stats add up', async () => {
      const list = (await adminClient.get('/api/admin/rsvps')).data.rsvps
      assert.ok(list.length > 3)
      assert.equal(list[0].dedupe_hash, undefined)
      const target = list.find((r) => r.name === 'Open Guest')
      assert.equal(target.wedding_events.title, 'Majlis Bersanding')
      assert.equal((await adminClient.put(`/api/admin/rsvps/${target.id}`, { json: { name: 'Open Guest', attending: true, party_size: 1 } })).status, 200)
      const stats = (await adminClient.get('/api/admin/stats')).data.stats
      const m = stats.events.find((e) => e.title === 'Majlis Bersanding')
      assert.equal(m.attending, 1)
      assert.equal(stats.invited_parties, 1)
      assert.equal(typeof stats.expected_attendees, 'number')
    })
  })

  // ------------------------------------------------------------------ photos
  describe('photos, GIFs and videos (instant publishing)', () => {
    let jpeg
    let gif
    let photoId
    // Minimal but structurally correct container headers (the API checks signatures, not codecs).
    const MP4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.from([0, 0, 2, 0]), Buffer.from('isomiso2'),
      Buffer.from([0, 0, 0, 0x10]), Buffer.from('mdat'), Buffer.alloc(8, 7),
    ])
    const WEBM = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84]),
      Buffer.from('webm'), Buffer.alloc(64, 1),
    ])
    const MOV = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  '), Buffer.alloc(64)])

    before(async () => {
      // A real JPEG carrying EXIF metadata to prove it is stripped.
      jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#d9c7a7' } })
        .withExif({ IFD0: { Copyright: 'secret-metadata', ImageDescription: 'GPS 4.89N 114.94E' } })
        .jpeg()
        .toBuffer()
      const frame = (c) => sharp({ create: { width: 64, height: 48, channels: 3, background: c } }).png().toBuffer()
      gif = await sharp(await Promise.all(['#d9c7a7', '#56694d', '#b5726b'].map(frame)), { join: { animated: true } }).gif({ delay: 200 }).toBuffer()
    })

    const upload = (buffer, fields = {}, { name = 'photo.jpg', type = 'image/jpeg', ip = '10.3.0.1', poster } = {}) => {
      const form = new FormData()
      for (const [k, v] of Object.entries({ name: 'Guest Photographer', consent: 'true', ...fields })) form.append(k, v)
      if (poster) form.append('poster', new Blob([poster], { type: 'image/jpeg' }), 'poster.jpg')
      form.append('photo', new Blob([buffer], { type }), name)
      return client(env.base).post('/api/public/photos', { form, ip }) // fresh client: anonymous, no cookies
    }
    const publicIds = async () => (await guest.get('/api/public/photos')).data.photos.map((p) => p.id)

    it('publishes a JPEG immediately — no approval step', async () => {
      const r = await upload(jpeg, { caption: 'Bersanding' })
      assert.equal(r.status, 201)
      assert.equal(r.data.status, 'published')
      photoId = r.data.item.id
      assert.equal(r.data.item.media_type, 'image')
      assert.ok((await publicIds()).includes(photoId), 'visible in the public gallery right away')
      const full = await guest.raw('GET', `/api${r.data.item.url}`)
      assert.equal(full.status, 200)
      assert.equal(full.headers.get('content-type'), 'image/jpeg')
      const [[row]] = await env.db.query('SELECT * FROM wedding_photos WHERE id = ?', [photoId])
      assert.equal(row.status, 'approved')
      assert.equal(row.media_type, 'image')
      assert.match(row.storage_key, /^photos\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/)
      assert.equal(row.width, 2400, 'resized to max 2400px')
      const meta = await sharp(path.join(env.uploads, row.storage_key)).metadata()
      assert.equal(meta.exif, undefined, 'EXIF metadata stripped')
      assert.ok(!(await fs.readFile(path.join(env.uploads, row.storage_key))).includes('secret-metadata'))
    })

    it('publishes several photos in a row', async () => {
      const small = await sharp({ create: { width: 200, height: 150, channels: 3, background: '#56694d' } }).jpeg().toBuffer()
      const ids = []
      for (let i = 0; i < 3; i++) ids.push((await upload(small, { caption: `Batch ${i}` }, { ip: '10.3.0.2' })).data.item.id)
      const visible = await publicIds()
      assert.ok(ids.every((id) => visible.includes(id)))
    })

    it('keeps animated GIFs animated (full + thumbnail)', async () => {
      const r = await upload(gif, { caption: 'Confetti' }, { name: 'party.gif', type: 'image/gif' })
      assert.equal(r.status, 201)
      assert.equal(r.data.item.media_type, 'gif')
      for (const variant of [r.data.item.url, r.data.item.thumbUrl]) {
        const res = await guest.raw('GET', `/api${variant}`)
        assert.equal(res.headers.get('content-type'), 'image/gif')
        const m = await sharp(Buffer.from(await res.arrayBuffer()), { animated: true }).metadata()
        assert.equal(m.pages, 3, 'all frames kept')
      }
    })

    it('publishes an MP4 video with a poster; supports range requests for playback', async () => {
      const poster = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#3a342d' } }).jpeg().toBuffer()
      const r = await upload(MP4, { width: '1920', height: '1080' }, { name: 'clip.mp4', type: 'video/mp4', poster })
      assert.equal(r.status, 201)
      const item = r.data.item
      assert.equal(item.media_type, 'video')
      assert.equal(item.mime_type, 'video/mp4')
      assert.ok(item.posterUrl && !item.thumbUrl?.endsWith('.mp4'))
      const video = await guest.raw('GET', `/api${item.url}`, { headers: { range: 'bytes=0-15' } })
      assert.equal(video.status, 206, 'Range supported (needed by iOS Safari)')
      assert.equal(video.headers.get('content-type'), 'video/mp4')
      assert.equal(video.headers.get('accept-ranges'), 'bytes')
      assert.deepEqual(Buffer.from(await video.arrayBuffer()), MP4.subarray(0, 16), 'stored byte-for-byte')
      const posterRes = await guest.raw('GET', `/api${item.posterUrl}`)
      assert.equal(posterRes.headers.get('content-type'), 'image/jpeg')
      const [[row]] = await env.db.query('SELECT width, height, mime_type FROM wedding_photos WHERE id = ?', [item.id])
      assert.deepEqual({ ...row }, { width: 1920, height: 1080, mime_type: 'video/mp4' })
    })

    it('publishes a WebM video without a poster (gallery shows its first frame)', async () => {
      const r = await upload(WEBM, {}, { name: 'clip.webm', type: 'video/webm' })
      assert.equal(r.status, 201)
      assert.equal(r.data.item.mime_type, 'video/webm')
      assert.equal(r.data.item.posterUrl, null)
      assert.equal(r.data.item.thumbUrl, null)
      assert.equal((await guest.raw('GET', `/api${r.data.item.url}`)).headers.get('content-type'), 'video/webm')
    })

    it('rejects files that are not really photos, GIFs or MP4/WebM — whatever their name or MIME type', async () => {
      const fakes = [
        [Buffer.from('<?php system($_GET["c"]); ?>'), 'shell.jpg', 'image/jpeg'],
        [Buffer.from('<!doctype html><script>alert(1)</script>'), 'page.mp4', 'video/mp4'],
        [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'],
        [Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'setup.webm', 'video/webm'],
        [MOV, 'iphone.mov', 'video/quicktime'],
        [Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40)]), 'broken.gif', 'image/gif'],
        [Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]), 'broken.jpg', 'image/jpeg'],
      ]
      const before = (await env.db.query('SELECT COUNT(*) n FROM wedding_photos'))[0][0].n
      for (const [buf, name, type] of fakes) {
        const r = await upload(buf, {}, { name, type, ip: '10.3.1.1' })
        assert.equal(r.status, 400, name)
      }
      assert.equal((await env.db.query('SELECT COUNT(*) n FROM wedding_photos'))[0][0].n, before, 'no rows for rejected files')
      const stored = await fs.readdir(env.uploads, { recursive: true })
      assert.ok(!stored.some((f) => /php|svg|html|\.mov/.test(f)))
      assert.deepEqual(await fs.readdir(path.join(env.uploads, '.tmp')), [], 'temp files cleaned up')
    })

    it('enforces per-type size limits', async () => {
      const bigVideo = Buffer.concat([MP4, Buffer.alloc(4 * 1024 * 1024)]) // test MAX_VIDEO_MB=3
      assert.equal((await upload(bigVideo, {}, { name: 'big.mp4', type: 'video/mp4', ip: '10.3.2.1' })).status, 413)
      const bigGif = Buffer.concat([gif, Buffer.alloc(3 * 1024 * 1024)]) // test MAX_GIF_MB=2
      assert.equal((await upload(bigGif, {}, { name: 'big.gif', type: 'image/gif', ip: '10.3.2.1' })).status, 413)
      const huge = Buffer.concat([jpeg, Buffer.alloc(16 * 1024 * 1024)]) // multer hard cap
      assert.equal((await upload(huge, {}, { ip: '10.3.2.1' })).status, 413)
      assert.deepEqual(await fs.readdir(path.join(env.uploads, '.tmp')), [], 'temp files cleaned up')
    })

    it('requires consent and a name (but no account or token)', async () => {
      assert.equal((await upload(jpeg, { consent: 'false' }, { ip: '10.3.2.2' })).status, 400)
      assert.equal((await upload(jpeg, { name: '' }, { ip: '10.3.2.2' })).status, 400)
    })

    it('leaves media from the old approval workflow unchanged', async () => {
      await env.db.query(
        `INSERT INTO wedding_photos (id, storage_key, thumb_key, source, status, consent_at, uploader_name)
         VALUES ('aaaaaaaa-0000-0000-0000-00000000000a', 'photos/2026-10/aaaaaaaa-0000-0000-0000-00000000000a.jpg',
                 'photos/2026-10/aaaaaaaa-0000-0000-0000-00000000000a_thumb.jpg', 'guest', 'pending', UTC_TIMESTAMP(), 'Old Guest')`,
      )
      await upload(jpeg, {}, { ip: '10.3.2.3' })
      const [[old]] = await env.db.query("SELECT status FROM wedding_photos WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'")
      assert.equal(old.status, 'pending')
      assert.ok(!(await publicIds()).includes('aaaaaaaa-0000-0000-0000-00000000000a'))
    })

    it('admin can hide and delete inappropriate media; files are removed', async () => {
      await adminClient.patch(`/api/admin/photos/${photoId}`, { json: { status: 'rejected' } })
      assert.ok(!(await publicIds()).includes(photoId))
      assert.equal((await guest.raw('GET', `/api/media/photos/${photoId}/full`)).status, 404)
      const videos = (await adminClient.get('/api/admin/photos?status=all')).data.photos.filter((p) => p.media_type === 'video')
      assert.ok(videos.length >= 2)
      const [[row]] = await env.db.query('SELECT storage_key, thumb_key FROM wedding_photos WHERE id = ?', [videos[0].id])
      assert.equal((await adminClient.del(`/api/admin/photos/${videos[0].id}`)).status, 200)
      await assert.rejects(fs.access(path.join(env.uploads, row.storage_key)))
      await assert.rejects(fs.access(path.join(env.uploads, row.thumb_key)))
    })

    it('hides media in private albums', async () => {
      const albums = (await adminClient.get('/api/admin/albums')).data.albums
      const guestAlbum = albums.find((a) => a.is_guest_uploads)
      const id = (await upload(jpeg, {}, { ip: '10.3.2.4' })).data.item.id
      await adminClient.put(`/api/admin/albums/${guestAlbum.id}`, { json: { ...guestAlbum, is_public: false } })
      assert.ok(!(await publicIds()).includes(id))
      await adminClient.put(`/api/admin/albums/${guestAlbum.id}`, { json: { ...guestAlbum, is_public: true } })
    })

    it('blocks path traversal on media routes', async () => {
      for (const p of ['/api/media/site/..%2F..%2Fpackage.json', '/api/media/site/../../.env', '/api/media/photos/..%2F..%2Fx/full']) {
        const r = await guest.raw('GET', p)
        assert.ok([400, 404].includes(r.status), `${p} → ${r.status}`)
      }
    })

    it('respects the photo-sharing switch', async () => {
      const settings = (await adminClient.get('/api/admin/settings')).data.settings
      await adminClient.put('/api/admin/settings', { json: { ...settings, photo_uploads_enabled: false } })
      assert.equal((await upload(jpeg, {}, { ip: '10.3.3.1' })).status, 403)
      await adminClient.put('/api/admin/settings', { json: { ...settings, photo_uploads_enabled: true } })
    })

    it('admin official upload accepts photos and videos; published immediately', async () => {
      const form = new FormData()
      form.append('photo', new Blob([WEBM], { type: 'video/webm' }), 'x.webm')
      const r = await adminClient.post('/api/admin/photos', { form })
      assert.equal(r.status, 201)
      assert.equal(r.data.photo.media_type, 'video')
      assert.ok((await publicIds()).includes(r.data.photo.id))
    })

    it('site assets upload to a public URL', async () => {
      const form = new FormData()
      form.append('image', new Blob([jpeg], { type: 'image/jpeg' }), 'hero.jpg')
      const r = await adminClient.post('/api/admin/assets', { form })
      assert.equal(r.status, 201)
      assert.match(r.data.url, /^\/media\/site\/[0-9a-f-]{36}\.jpg$/)
      assert.equal((await guest.raw('GET', `/api${r.data.url}`)).status, 200)
    })

    it('guest uploads are rate limited (40/hour/IP)', async () => {
      const small = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#fff' } }).jpeg().toBuffer()
      let last
      for (let i = 0; i < 41; i++) last = await upload(small, {}, { ip: '10.3.9.9' })
      assert.equal(last.status, 429)
    })
  })

  // ------------------------------------------------------------------ settings & albums
  describe('settings, events & albums', () => {
    it('validates settings and preserves Malay/Arabic text round-trip', async () => {
      const s = (await adminClient.get('/api/admin/settings')).data.settings
      assert.equal((await adminClient.put('/api/admin/settings', { json: { ...s, timezone: 'Mars/Base' } })).status, 400)
      assert.equal((await adminClient.put('/api/admin/settings', { json: { ...s, rsvp_mode: 'whatever' } })).status, 400)
      const content = { ...s.content, footer: { message: 'Terima kasih — شكرا' } }
      const r = await adminClient.put('/api/admin/settings', { json: { ...s, content } })
      assert.equal(r.status, 200)
      assert.equal((await guest.get('/api/public/site')).data.settings.content.footer.message, 'Terima kasih — شكرا')
    })

    it('family groups saved by the admin are served exactly as stored, other content untouched', async () => {
      const s = (await adminClient.get('/api/admin/settings')).data.settings
      const familyGroups = [
        { title: 'Group One', members: 'Awg Test Bin Satu\nDyg Test Binti Dua (Isteri)' },
        { title: 'Group Two', members: 'Awg Test Bin Tiga\nDyg Test Binti Empat(Isteri)\nAwg Syafie’e Test' },
      ]
      const content = { ...s.content, invitation: { ...s.content.invitation, familyGroups } }
      assert.equal((await adminClient.put('/api/admin/settings', { json: { ...s, content } })).status, 200)
      const served = (await guest.get('/api/public/site')).data.settings
      assert.deepEqual(served.content.invitation.familyGroups, familyGroups)
      assert.equal(served.content.invitation.message, s.content.invitation.message)
      assert.equal(served.content.couple.fullNameOne, s.content.couple.fullNameOne)
      assert.equal(served.wedding_date, s.wedding_date)
      // Restore what the seed stored.
      assert.equal((await adminClient.put('/api/admin/settings', { json: s })).status, 200)
    })

    it('rejects non-https map links', async () => {
      const r = await adminClient.post('/api/admin/events', { json: { title: 'X', max_party_size: 1, maps_url: 'javascript:alert(1)' } })
      assert.equal(r.status, 400)
    })

    it('keeps exactly one guest-upload album', async () => {
      const albums = (await adminClient.get('/api/admin/albums')).data.albums
      const couple = albums.find((a) => a.slug === 'couple')
      await adminClient.put(`/api/admin/albums/${couple.id}`, { json: { ...couple, is_guest_uploads: true } })
      const [[{ n }]] = await env.db.query('SELECT COUNT(*) n FROM wedding_albums WHERE is_guest_uploads = 1')
      assert.equal(Number(n), 1)
    })

    it('unknown API routes return JSON 404 without internals', async () => {
      const r = await guest.get('/api/nope')
      assert.equal(r.status, 404)
      assert.equal(r.data.success, false)
    })
  })
})
