import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64
const PARAMS = { N: 16384, r: 8, p: 1 }

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 200

export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > MAX_PASSWORD_LENGTH) return 'Password is too long.'
  return null
}

// Format: scrypt$N$r$p$saltB64$hashB64
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$')
}

let dummyHash
// Always does the same amount of work, even for unknown accounts, so response
// time does not reveal which accounts exist.
export async function verifyPassword(password, stored) {
  dummyHash ??= await hashPassword('dummy-password-for-timing')
  const [scheme, N, r, p, saltB64, hashB64] = (stored ?? dummyHash).split('$')
  if (scheme !== 'scrypt' || typeof password !== 'string') return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return stored != null && timingSafeEqual(actual, expected)
}

