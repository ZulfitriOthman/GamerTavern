// Display helpers shared by the admin and portal apps.

// price_cents → "RM 199.90" (null → null: no price set)
export function formatPrice(cents, currency = 'MYR') {
  if (cents === null || cents === undefined) return null
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`
  }
}

// cents → "199.90" for an <input>; null → ''
export const priceInputValue = (cents) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2))

// SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC) → local date/time
export function formatDate(value, fallback = '—') {
  if (!value) return fallback
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString()
}

// Same input, date only (for dense tables).
export function formatDay(value, fallback = '—') {
  if (!value) return fallback
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
