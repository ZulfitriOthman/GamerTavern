import { zonedTimeToUtc } from './time.js'

const pad = (n) => String(n).padStart(2, '0')
const toIcsUtc = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

const escapeIcs = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Returns [start, end] Dates for an event, defaulting to a 3-hour slot. */
export function eventInstants(event, timeZone) {
  const start = zonedTimeToUtc(event.event_date, event.start_time ?? '10:00', timeZone)
  if (!start) return null
  let end = event.end_time ? zonedTimeToUtc(event.event_date, event.end_time, timeZone) : null
  if (!end || end <= start) end = new Date(start.getTime() + 3 * 3600 * 1000)
  return [start, end]
}

export function mapsLink(event) {
  if (event.maps_url) return event.maps_url
  const query = [event.venue_name, event.address].filter(Boolean).join(', ')
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

export function googleCalendarLink(event, timeZone, coupleTitle) {
  const range = eventInstants(event, timeZone)
  if (!range) return ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${event.title} — ${coupleTitle}`,
    dates: `${toIcsUtc(range[0])}/${toIcsUtc(range[1])}`,
    location: [event.venue_name, event.address].filter(Boolean).join(', '),
    details: event.description ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function buildIcs(event, timeZone, coupleTitle, now = new Date()) {
  const range = eventInstants(event, timeZone)
  if (!range) return ''
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Website//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@wedding`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(range[0])}`,
    `DTEND:${toIcsUtc(range[1])}`,
    `SUMMARY:${escapeIcs(`${event.title} — ${coupleTitle}`)}`,
    `LOCATION:${escapeIcs([event.venue_name, event.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeIcs(event.description ?? '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
