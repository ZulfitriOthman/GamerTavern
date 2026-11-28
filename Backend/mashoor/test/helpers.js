import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { openDatabase } from '../src/db.js'
import { applyMigrations } from '../src/migrations.js'
import { hashPassword } from '../src/auth/passwords.js'

export const APP_ORIGIN = 'http://localhost:5301'
export const PORTAL_APP_ORIGIN = 'http://localhost:5302'

// Tests run against a disposable MySQL / MariaDB server — never the Backend's
// database. MASHOOR_TEST_MYSQL_URL (Backend/.env.test, loaded by
// `npm run mashoor:test`) is mysql://user:password@host:port of an account
// that may create databases named mashoor_test_*.
export function testServerSettings() {
  const raw = process.env.MASHOOR_TEST_MYSQL_URL
  if (!raw) {
    throw new Error('MASHOOR_TEST_MYSQL_URL is not set: point it at a disposable MySQL/MariaDB test server (see Backend/.env.test).')
  }
  const url = new URL(raw)
  return { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
}

/**
 * A brand-new database (mashoor_test_<random>) with every migration applied.
 * Returns { mysqlConfig, open(options), drop() }.
 */
export async function createTestDatabase({ migrations } = {}) {
  const server = testServerSettings()
  const database = `mashoor_test_${randomBytes(6).toString('hex')}`
  const admin = await mysql.createConnection(server)
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await admin.end()
  const mysqlConfig = { ...server, database, connectionLimit: 5 }
  const bootstrap = await openDatabase(mysqlConfig, { checkMigrations: false, importChecklists: false, log: false })
  try {
    await applyMigrations(bootstrap, migrations)
  } finally {
    await bootstrap.close()
  }
  return {
    mysqlConfig,
    open: (options = {}) => openDatabase(mysqlConfig, { log: false, ...options }),
    async drop() {
      const conn = await mysql.createConnection(server)
      await conn.query(`DROP DATABASE IF EXISTS \`${database}\``)
      await conn.end()
    },
  }
}

// Boots the real Express app on a random port with a fresh test database.
export async function startTestServer({ limiter, config: overrides = {} } = {}) {
  const testDb = await createTestDatabase()
  const db = await testDb.open()
  const storageDir = mkdtempSync(join(tmpdir(), 'mashoor-test-'))
  const config = { ...loadConfig({}), mysql: testDb.mysqlConfig, storageDir, allowedOrigins: [APP_ORIGIN, PORTAL_APP_ORIGIN], cookieSecure: false, ...overrides }
  const app = createApp({ db, config, ...(limiter && { limiter }) })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  return {
    db,
    storageDir,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      await new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      })
      await db.close()
      await testDb.drop()
    },
  }
}

export async function insertStaff(db, { email, name = 'Staff', password }) {
  await db.prepare('INSERT INTO mashoor_staff_users (email, name, password_hash) VALUES (?, ?, ?)').run(email, name, await hashPassword(password))
}

// A minimal HTTP client with a cookie jar: one instance = one browser session.
// It deliberately ignores cookie Path and sends every cookie it holds to every
// endpoint, which is a stricter test than a real browser would give.
export class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.cookies = new Map()
  }

  async request(method, path, { body, headers = {} } = {}) {
    const finalHeaders = { ...headers }
    if (body !== undefined) finalHeaders['content-type'] = 'application/json'
    if (this.cookies.size) {
      finalHeaders.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.getSetCookie()
    for (const cookie of setCookie) {
      const [pair] = cookie.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (!value || /expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = text
    }
    return { status: res.status, body: json, setCookie }
  }

  get(path, opts) {
    return this.request('GET', path, opts)
  }
  post(path, body, opts) {
    return this.request('POST', path, { ...opts, body })
  }
  patch(path, body, opts) {
    return this.request('PATCH', path, { ...opts, body })
  }
  put(path, body, opts) {
    return this.request('PUT', path, { ...opts, body })
  }
  delete(path, opts) {
    return this.request('DELETE', path, opts)
  }

  // multipart/form-data upload of one file in the "image" field.
  async upload(path, buffer, { filename = 'image.png', type = 'image/png', headers = {} } = {}) {
    const form = new FormData()
    form.append('image', new Blob([buffer], { type }), filename)
    const finalHeaders = { ...headers }
    if (this.cookies.size) finalHeaders.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await fetch(this.baseUrl + path, { method: 'PUT', headers: finalHeaders, body: form })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers }
  }

  // Raw GET (for binary responses such as images).
  async raw(path) {
    const headers = this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}
    const res = await fetch(this.baseUrl + path, { headers })
    return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) }
  }
}

// 1×1 transparent PNG.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
