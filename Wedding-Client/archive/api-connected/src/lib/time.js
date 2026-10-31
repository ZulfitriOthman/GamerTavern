// Date/time helpers. Event dates and times are stored as wall-clock values in
// the wedding's time zone (settings.timezone), so they are formatted and
// counted down in that zone — not the visitor's.

const pad = (n) => String(n).padStart(2, '0')

/** "2027-01-01" (or a Date/ISO string from MySQL) → "2027-01-01". */
export function isoDate(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffset(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Wall-clock date + time in a zone → the real instant (Date). */
export function zonedInstant(dateStr, timeStr, timeZone = 'UTC') {
  const day = isoDate(dateStr)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  const [hh = 0, mm = 0] = String(timeStr || '00:00').split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  try {
    const first = guess - zoneOffset(new Date(guess), timeZone)
    return new Date(guess - zoneOffset(new Date(first), timeZone))
  } catch {
    return new Date(guess)
  }
}

/** Formats a stored calendar date without shifting it across time zones. */
export function formatDate(value, locale = 'en-GB', options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const day = isoDate(value)
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return day
  }
}

const isMalay = (locale) => /^ms\b/i.test(locale || '')

/** Malay invitation style: 13:15 → { clock: '1.15', period: 'Petang' }. */
function malayTime(hh, mm) {
  const period = hh < 12 ? 'Pagi' : hh < 13 ? 'Tengah Hari' : hh < 19 ? 'Petang' : 'Malam'
  return { clock: `${hh % 12 || 12}.${pad(mm || 0)}`, period }
}

const parseTime = (value) => {
  const [hh, mm] = String(value ?? '').split(':').map(Number)
  return value && Number.isFinite(hh) ? [hh, mm || 0] : null
}

/** "13:30:00" → "1:30 pm" (en) or "1.30 Petang" (ms). */
export function formatTime(value, locale = 'en-GB') {
  const t = parseTime(value)
  if (!t) return ''
  if (isMalay(locale)) {
    const { clock, period } = malayTime(...t)
    return `${clock} ${period}`
  }
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, ...t)))
  } catch {
    return `${pad(t[0])}:${pad(t[1])}`
  }
}

/** "1.15 – 2.15 Petang" (the period is written once when both ends share it). */
export function formatTimeRange(start, end, locale) {
  const a = formatTime(start, locale)
  const b = formatTime(end, locale)
  if (!a || !b) return a
  if (isMalay(locale)) {
    const [x, y] = [malayTime(...parseTime(start)), malayTime(...parseTime(end))]
    if (x.period === y.period) return `${x.clock} – ${y.clock} ${y.period}`
  }
  return `${a} – ${b}`
}

/** Remaining time split into parts; all zeros once passed. */
export function countdownParts(target, now = Date.now()) {
  const ms = Math.max(0, (target?.getTime?.() ?? 0) - now)
  return {
    done: ms === 0,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  }
}

/** True once the end of the deadline day (in the wedding's zone) has passed. */
export function isPastDeadline(deadline, timeZone, now = Date.now()) {
  const day = isoDate(deadline)
  if (!day) return false
  const end = zonedInstant(day, '23:59', timeZone)
  return end ? now > end.getTime() + 59_999 : false
}

export function formatDateTime(value, locale = 'en-GB') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
}

export function timeAgo(value, now = Date.now()) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const s = Math.round((now - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const units = [
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
  ]
  let n = s / 60
  for (const [size, unit] of units) {
    if (n < size) return `${Math.floor(n)} ${unit}${Math.floor(n) === 1 ? '' : 's'} ago`
    n /= size
  }
  return `${Math.floor(n)} year${Math.floor(n) === 1 ? '' : 's'} ago`
}
