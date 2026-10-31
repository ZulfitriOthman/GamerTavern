// Sliding-window rate limiter backed by the wedding_rate_limits table, so
// limits hold across restarts and multiple API processes (unlike the
// in-memory limiter in Backend/modules/rateLimiter.module.js).
import { keyHash } from '../lib/crypto.js'
import { tooMany } from '../lib/errors.js'

export async function consume(db, bucket, rawKey, max, windowSeconds) {
  const key = rawKey === 'all' ? 'all' : keyHash(rawKey)
  const [rows] = await db.query(
    'SELECT COUNT(*) AS n FROM wedding_rate_limits WHERE bucket = ? AND key_hash = ? AND created_at > UTC_TIMESTAMP() - INTERVAL ? SECOND',
    [bucket, key, windowSeconds],
  )
  if (rows[0].n >= max) return false
  await db.query('INSERT INTO wedding_rate_limits (bucket, key_hash) VALUES (?, ?)', [bucket, key])
  return true
}

/** Consumes every rule; throws a 429 with `message` if any is exceeded. */
export async function enforce(db, rules, message) {
  for (const [bucket, key, max, windowSeconds] of rules) {
    if (!(await consume(db, bucket, key, max, windowSeconds))) throw tooMany(message)
  }
}

export async function cleanup(db) {
  await db.query('DELETE FROM wedding_rate_limits WHERE created_at < UTC_TIMESTAMP() - INTERVAL 2 DAY')
  await db.query('DELETE FROM wedding_admin_sessions WHERE expires_at < UTC_TIMESTAMP()')
}
