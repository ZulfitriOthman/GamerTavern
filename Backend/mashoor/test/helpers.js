import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { openDatabase } from '../src/db.js'
import { hashPassword } from '../src/auth/passwords.js'

export const APP_ORIGIN = 'http://localhost:5301'
export const PORTAL_APP_ORIGIN = 'http://localhost:5302'

// Boots the real Express app on a random port with a fresh in-memory database.
export async function startTestServer({ limiter } = {}) {
  const db = openDatabase(':memory:')
  const storageDir = mkdtempSync(join(tmpdir(), 'mashoor-test-'))
  const config = { ...loadConfig({}), dbPath: ':memory:', storageDir, allowedOrigins: [APP_ORIGIN, PORTAL_APP_ORIGIN], cookieSecure: false }
  const app = createApp({ db, config, ...(limiter && { limiter }) })
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  return {
    db,
    storageDir,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      }),
  }
}

export async function insertStaff(db, { email, name = 'Staff', password }) {
  db.prepare('INSERT INTO staff_users (email, name, password_hash) VALUES (?, ?, ?)').run(
    email,
    name,
    await hashPassword(password),
  )
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
