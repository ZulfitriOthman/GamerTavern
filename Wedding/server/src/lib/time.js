// Same wall-clock → UTC conversion as the frontend's src/lib/time.js.
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
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(date.getTime() / 1000) * 1000
}

export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '')
  if (!dm) return null
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeStr ?? '00:00') ?? []
  const naive = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +(tm[1] ?? 0), +(tm[2] ?? 0), +(tm[3] ?? 0))
  try {
    const first = naive - offsetMs(new Date(naive), timeZone)
    return new Date(naive - offsetMs(new Date(first), timeZone))
  } catch {
    return new Date(naive)
  }
}

/** The RSVP deadline is inclusive: replies close at the end of that day in the wedding time zone. */
export function isPastDeadline(deadline, timeZone, now = new Date()) {
  if (!deadline) return false
  const end = zonedTimeToUtc(deadline, '23:59:59', timeZone)
  return end ? now > end : false
}
