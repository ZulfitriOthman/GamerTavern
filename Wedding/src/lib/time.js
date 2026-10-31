// Dates are stored as plain wall-clock values (date + time) in the wedding's
// time zone, so guests anywhere see the venue's local time. These helpers
// convert to absolute instants only where needed (countdown, calendar files).

function offsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Converts a wall-clock date/time in `timeZone` to a UTC Date. Returns null for missing/invalid input. */
export function zonedTimeToUtc(dateStr, timeStr, timeZone = 'UTC') {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '')
  if (!dm) return null
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeStr ?? '00:00') ?? []
  const naive = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +(tm[1] ?? 0), +(tm[2] ?? 0), +(tm[3] ?? 0))
  try {
    const first = naive - offsetMs(new Date(naive), timeZone)
    const second = offsetMs(new Date(first), timeZone)
    return new Date(naive - second)
  } catch {
    return new Date(naive)
  }
}

/** Formats a 'YYYY-MM-DD' date without any time-zone shifting. */
export function formatDate(dateStr, locale = 'en-GB', options = {}) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '')
  if (!dm) return ''
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3])))
}

/** Formats 'HH:MM[:SS]' as a localised time, e.g. "2:30 pm". */
export function formatTime(timeStr, locale = 'en-GB') {
  const tm = /^(\d{2}):(\d{2})/.exec(timeStr ?? '')
  if (!tm) return ''
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, 0, 1, +tm[1], +tm[2])),
  )
}

export function formatTimeRange(start, end, locale) {
  const a = formatTime(start, locale)
  const b = formatTime(end, locale)
  if (a && b) return `${a} – ${b}`
  return a
}

/** Splits a millisecond duration into countdown parts. */
export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/** True when the RSVP deadline (inclusive, end of day in the wedding time zone) has passed. */
export function isPastDeadline(deadline, timeZone, now = new Date()) {
  if (!deadline) return false
  const end = zonedTimeToUtc(deadline, '23:59:59', timeZone)
  return end ? now > end : false
}
