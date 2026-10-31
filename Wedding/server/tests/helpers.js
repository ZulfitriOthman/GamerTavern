// Integration-test harness.
//
// Requires a MySQL/MariaDB server you are happy to create throwaway databases
// on (NEVER your production server), configured with:
//   TEST_MYSQL_HOST, TEST_MYSQL_PORT, TEST_MYSQL_USER, TEST_MYSQL_PASSWORD
// The user needs CREATE/DROP DATABASE. Each run creates `wedding_it_<random>`,
// applies Wedding/database/migrations + seeds exactly as written, runs the
// API against it, then drops that database again.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbDir = path.resolve(here, '../../database')

export const testDbConfigured = Boolean(process.env.TEST_MYSQL_USER)

/** opts.excludeMigrations: e.g. ['010'] to test a database that has not run a migration yet. */
export async function setup({ excludeMigrations = [] } = {}) {
  const conn = {
    host: process.env.TEST_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.TEST_MYSQL_PORT || 3306),
    user: process.env.TEST_MYSQL_USER,
    password: process.env.TEST_MYSQL_PASSWORD || '',
  }
  const database = `wedding_it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const admin = await mysql.createConnection({ ...conn, multipleStatements: true, charset: 'utf8mb4_unicode_ci' })
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await admin.query(`USE \`${database}\``)
  for (const folder of ['migrations', 'seeds']) {
    for (const file of (await fs.readdir(path.join(dbDir, folder))).filter((f) => f.endsWith('.sql') && !excludeMigrations.some((v) => f.startsWith(`${v}_`))).sort()) {
      await admin.query(await fs.readFile(path.join(dbDir, folder, file), 'utf8'))
    }
  }

  const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'wedding-uploads-'))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MYSQL_HOST: conn.host,
    MYSQL_PORT: String(conn.port),
    MYSQL_USER: conn.user,
    MYSQL_PASSWORD: conn.password,
    MYSQL_DATABASE: database,
    IP_HASH_SALT: 'test-salt',
    UPLOAD_DIRECTORY: uploads,
    ALLOWED_ORIGINS: 'http://allowed.test',
    BCRYPT_ROUNDS: '4',
    MAX_GIF_MB: '2',
    MAX_VIDEO_MB: '3',
    TRUST_PROXY: 'loopback',
    DOTENV_FILE: path.join(here, 'does-not-exist.env'),
  })

  const { createPool } = await import('../src/db.js')
  const { createApp } = await import('../src/app.js')
  const { ensureUploadDir } = await import('../src/lib/storage.js')
  await ensureUploadDir()
  const db = createPool()
  const server = createApp({ db }).listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`

  return {
    db,
    base,
    uploads,
    async teardown() {
      await new Promise((r) => server.close(r))
      await db.end()
      await admin.query(`DROP DATABASE \`${database}\``)
      await admin.end()
      await fs.rm(uploads, { recursive: true, force: true })
    },
  }
}

/** Minimal client with a cookie jar and optional per-request client IP. */
export function client(base) {
  let cookie = ''
  let csrf = ''
  async function request(method, url, { json, form, ip, headers = {}, raw = false } = {}) {
    const h = { ...headers }
    if (cookie) h.cookie = cookie
    if (csrf && !['GET', 'HEAD'].includes(method)) h['x-csrf-token'] ??= csrf
    if (ip) h['x-forwarded-for'] = ip
    let body
    if (json !== undefined) {
      h['content-type'] = 'application/json'
      body = JSON.stringify(json)
    } else if (form) body = form
    const res = await fetch(base + url, { method, headers: h, body, redirect: 'manual' })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    if (raw) return res
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
    if (data?.csrfToken) csrf = data.csrfToken
    return { status: res.status, data, headers: res.headers }
  }
  return {
    get: (u, o) => request('GET', u, o),
    post: (u, o) => request('POST', u, o),
    put: (u, o) => request('PUT', u, o),
    patch: (u, o) => request('PATCH', u, o),
    del: (u, o) => request('DELETE', u, o),
    raw: (m, u, o) => request(m, u, { ...o, raw: true }),
    get cookie() {
      return cookie
    },
    get csrf() {
      return csrf
    },
    forgetCsrf() {
      csrf = ''
    },
  }
}
