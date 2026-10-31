import crypto from 'node:crypto'
import { config } from '../config.js'

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
/**
 * Time-ordered UUID (RFC 9562 version 7): 48-bit millisecond timestamp + random.
 * As text it sorts chronologically, so it breaks ties between rows created in
 * the same second (created_at has 1-second resolution) — e.g. guestbook order.
 */
export function newId() {
  const bytes = crypto.randomBytes(16)
  const ms = BigInt(Date.now())
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC variant
  const h = bytes.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Salted hash so IPs/emails used for rate limiting are never stored raw. */
export const keyHash = (value) => sha256(`${config.ipHashSalt}:${value ?? 'unknown'}`)

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** Invitation tokens: 24 random bytes, base64url (32 chars). Only the hash is stored. */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/
