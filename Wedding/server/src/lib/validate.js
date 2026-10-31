// Server-side validation. These rules replace the CHECK constraints and
// PL/pgSQL validation of the previous Supabase version and mirror
// src/lib/validation.js in the frontend.
import { badRequest } from './errors.js'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^[+()0-9\s-]{6,40}$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Trims, strips control characters; returns null for empty. */
export function cleanText(value) {
  if (value === null || value === undefined) return null
  // eslint-disable-next-line no-control-regex
  const s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  return s === '' ? null : s
}

export function text(value, { field, max, min = 0, required = false }) {
  const s = cleanText(value)
  if (s === null) {
    if (required || min > 0) throw badRequest(`Please enter ${field}.`)
    return null
  }
  if (s.length < min) throw badRequest(`Please enter ${field}.`)
  if (s.length > max) throw badRequest(`Please keep ${field} under ${max} characters.`)
  return s
}

export function email(value) {
  const s = cleanText(value)?.toLowerCase() ?? null
  if (s && (s.length > 254 || !EMAIL_RE.test(s))) throw badRequest('Please enter a valid email address.')
  return s
}

export function phone(value) {
  const s = cleanText(value)
  if (s && !PHONE_RE.test(s)) throw badRequest('Please enter a valid phone number.')
  return s
}

export function int(value, { field, min, max, nullable = false }) {
  if ((value === null || value === undefined || value === '') && nullable) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} must be a whole number between ${min} and ${max}.`)
  return n
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export function date(value, field) {
  const s = cleanText(value)
  if (s === null) return null
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw badRequest(`${field} must be a valid date.`)
  return s
}

export function time(value, field) {
  const s = cleanText(value)
  if (s === null) return null
  if (!TIME_RE.test(s)) throw badRequest(`${field} must be a valid time.`)
  return s.length === 5 ? `${s}:00` : s
}

export function uuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw badRequest(`Invalid ${field}.`)
  return value.toLowerCase()
}

export function timezone(value) {
  const s = cleanText(value) ?? 'Asia/Brunei'
  try {
    new Intl.DateTimeFormat('en', { timeZone: s })
  } catch {
    throw badRequest(`“${s}” is not a valid time zone (e.g. Asia/Brunei).`)
  }
  return s
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw badRequest(`Invalid ${field}.`)
  return value
}

/** Parses a JSON column stored as LONGTEXT. */
export function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}
