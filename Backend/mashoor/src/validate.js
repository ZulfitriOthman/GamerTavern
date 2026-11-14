const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null
}

export function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

export function parseId(value) {
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}

export const badRequest = (res, error) => res.status(400).json({ error })
export const notFound = (res) => res.status(404).json({ error: 'Not found.' })

// Accepts a positive integer id from JSON (number) or a URL/query string.
export function parseIdValue(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null
  return parseId(value)
}

// One normalization for every category-name comparison: Unicode NFKC, trimmed,
// inner whitespace collapsed. `key` (lower-cased) is what must be unique.
export function normalizeCategoryName(value) {
  if (typeof value !== 'string') return null
  const name = value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!name || name.length > 100) return null
  return { name, key: name.toLocaleLowerCase('en-US') }
}

// "12", "12.5", "12.50" (or a JSON number) → integer cents.
// Empty / null → null (no price). Anything else → undefined (invalid).
export function parsePrice(value) {
  if (value === null || value === undefined) return null
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : undefined
  if (text === undefined) return undefined
  if (text === '') return null
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return undefined
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

// Vendor usernames: one canonical form for storing, uniqueness and sign-in —
// Unicode NFKC, trimmed, lower-cased (so "Alice" and "alice" are the same
// account); 3–40 of a-z 0-9 . _ - starting with a letter or digit.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/
export const USERNAME_RULE =
  'Username must be 3–40 characters (letters, digits, dot, dash or underscore) and start with a letter or digit.'
export function normalizeUsername(value) {
  if (typeof value !== 'string') return null
  const username = value.normalize('NFKC').trim().toLowerCase()
  return USERNAME_PATTERN.test(username) ? username : null
}
