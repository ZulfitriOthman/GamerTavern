// "Add to calendar" for an event: a Google Calendar link and an .ics file.
import { isoDate, zonedInstant } from './time.js'

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function range(event, timeZone) {
  const day = isoDate(event.event_date)
  if (!day) return null
  const start = zonedInstant(day, event.start_time || '09:00', timeZone)
  // No confirmed end time → the entry marks the start only (no invented duration).
  const end = event.end_time ? zonedInstant(day, event.end_time, timeZone) : start
  return { start, end: end >= start ? end : start }
}

const where = (e) => [e.venue_name, e.address].filter(Boolean).join(', ')

export function googleCalendarUrl(event, timeZone, title) {
  const r = range(event, timeZone)
  if (!r) return ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title ? `${event.title} — ${title}` : event.title,
    dates: `${stamp(r.start)}/${stamp(r.end)}`,
    details: event.description || '',
    location: where(event),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

const esc = (s) => String(s ?? '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

export function icsContent(event, timeZone, title) {
  const r = range(event, timeZone)
  if (!r) return ''
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding//Invitation//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@wedding`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(r.start)}`,
    `DTEND:${stamp(r.end)}`,
    `SUMMARY:${esc(title ? `${event.title} — ${title}` : event.title)}`,
    `LOCATION:${esc(where(event))}`,
    `DESCRIPTION:${esc(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(event, timeZone, title) {
  const text = icsContent(event, timeZone, title)
  if (!text) return
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${event.title.replace(/[^\w-]+/g, '-')}.ics` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
