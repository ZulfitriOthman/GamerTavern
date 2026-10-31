// The API must keep working on a database where migration 010 (media_type /
// mime_type columns) has not been run yet: photos upload and display as before,
// GIFs/videos are declined politely, and nothing crashes.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import sharp from 'sharp'
import { client, setup, testDbConfigured } from './helpers.js'

const skip = testDbConfigured ? false : 'set TEST_MYSQL_* to run MySQL integration tests (see tests/helpers.js)'

describe('database without migration 010', { skip }, () => {
  let env
  before(async () => {
    env = await setup({ excludeMigrations: ['010'] })
  })
  after(async () => env?.teardown())

  const upload = async (buffer, name, type) => {
    const form = new FormData()
    form.append('name', 'Guest')
    form.append('consent', 'true')
    form.append('photo', new Blob([buffer], { type }), name)
    return client(env.base).post('/api/public/photos', { form, ip: '10.9.0.1' })
  }

  it('reports mediaTypes:false in health', async () => {
    const r = await client(env.base).get('/api/health')
    assert.equal(r.data.mediaTypes, false)
  })

  it('photos still upload, publish and list as images', async () => {
    const jpeg = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#d9c7a7' } }).jpeg().toBuffer()
    const r = await upload(jpeg, 'a.jpg', 'image/jpeg')
    assert.equal(r.status, 201)
    assert.equal(r.data.item.media_type, 'image')
    const list = (await client(env.base).get('/api/public/photos')).data.photos
    assert.deepEqual(list.map((p) => [p.id, p.media_type]), [[r.data.item.id, 'image']])
  })

  it('declines GIFs and videos with a clear message until the migration is run', async () => {
    const frame = (c) => sharp({ create: { width: 8, height: 8, channels: 3, background: c } }).png().toBuffer()
    const gif = await sharp(await Promise.all(['#000', '#fff'].map(frame)), { join: { animated: true } }).gif().toBuffer()
    const r = await upload(gif, 'a.gif', 'image/gif')
    assert.equal(r.status, 503)
    assert.equal(r.data.code, 'MEDIA_TYPES_UNAVAILABLE')
    assert.match(r.data.message, /photos can/)
  })
})
