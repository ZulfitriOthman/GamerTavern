// Environment configuration. Variable names follow Backend/env.example
// (MYSQL_HOST, MYSQL_PORT, …) so the same MySQL server can be reused with a
// separate, wedding-only database user.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The wedding API also runs INSIDE the shared GamerTavern Backend process
// (mounted at /api/wedding). So its .env is parsed privately — never written to
// process.env — and its values take precedence over the host's variables.
// Otherwise e.g. PORT=4100 or MYSQL_* could leak into the Backend's own config.
function readEnvFile(file) {
  try {
    return dotenv.parse(fs.readFileSync(file))
  } catch {
    return {}
  }
}
const env = { ...process.env, ...readEnvFile(process.env.DOTENV_FILE || path.join(serverRoot, '.env')) }
const isProduction = env.NODE_ENV === 'production'
const list = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const int = (v, fallback) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : fallback)
const bool = (v, fallback) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes'].includes(String(v).toLowerCase()))

function secret(name) {
  if (env[name]) return env[name]
  if (isProduction) throw new Error(`[wedding-api] ${name} must be set in production`)
  console.warn(`[wedding-api] ${name} not set — using a random value for this process (development only).`)
  return crypto.randomBytes(32).toString('hex')
}

export const config = {
  isProduction,
  port: int(env.PORT, 4100),
  trustProxy: env.TRUST_PROXY === undefined ? 1 : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY,
  allowedOrigins: list(env.ALLOWED_ORIGINS || (isProduction ? '' : 'http://localhost:5173')),
  publicSiteUrl: (env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  mysql: {
    host: env.MYSQL_HOST || '127.0.0.1',
    port: int(env.MYSQL_PORT, 3306),
    user: env.MYSQL_USER || '',
    password: env.MYSQL_PASSWORD ?? '',
    database: env.MYSQL_DATABASE || '',
    connectionLimit: int(env.MYSQL_CONN_LIMIT, 10),
    connectTimeout: int(env.MYSQL_CONNECT_TIMEOUT, 10000),
  },
  ipHashSalt: secret('IP_HASH_SALT'),
  session: {
    cookieName: 'wedding_admin',
    ttlHours: int(env.SESSION_TTL_HOURS, 12),
    secureCookie: bool(env.COOKIE_SECURE, isProduction),
    sameSite: (env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  },
  uploads: {
    dir: path.resolve(serverRoot, env.UPLOAD_DIRECTORY || 'uploads'),
    // Per-type limits (MB). Keep MAX_VIDEO_MB under your proxy's request limit
    // (Cloudflare's free plan rejects request bodies over 100 MB).
    maxFileMb: int(env.MAX_UPLOAD_MB, 15),
    maxGifMb: int(env.MAX_GIF_MB, 20),
    maxVideoMb: int(env.MAX_VIDEO_MB, 95),
    quotaMb: int(env.UPLOAD_QUOTA_MB, 5000),
  },
  bcryptRounds: int(env.BCRYPT_ROUNDS, 12),
}

// The API still starts without database settings so it can answer with a clear
// "database unavailable" error instead of the frontend seeing ECONNREFUSED.
config.mysql.configured = Boolean(config.mysql.user && config.mysql.database)

if (config.session.sameSite === 'none' && !config.session.secureCookie) {
  throw new Error('[wedding-api] COOKIE_SAMESITE=none requires COOKIE_SECURE=true')
}
