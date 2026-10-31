// Pure helpers over src/data/weddingData.js.
import { formatTime, formatTimeRange } from './time.js'

const str = (v) => (typeof v === 'string' ? v.trim() : '')

export const venueById = (data, id) => data.venues.find((v) => v.id === id) ?? null

/** The venue's own map link, else a Google Maps search for its name and address. */
export function mapsLink(venue) {
  if (/^https:\/\//i.test(str(venue?.mapsUrl))) return venue.mapsUrl
  const q = [venue?.name, venue?.address].filter(Boolean).join(', ').replace(/\s*\n\s*/g, ', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''
}

/** Shape lib/calendar.js expects. */
export const calendarEvent = (event, venue) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  event_date: event.date,
  start_time: event.startTime,
  end_time: event.endTime,
  venue_name: venue?.name,
  address: venue?.address?.replace(/\s*\n\s*/g, ', '),
})

export function monogram(couple) {
  return `${str(couple?.groom?.firstName).charAt(0)}${str(couple?.bride?.firstName).charAt(0)}`.toUpperCase() || '♥'
}

/** Accepts "@handle", "handle" or an https:// Instagram URL. */
export function instagramLink(value) {
  const v = str(value)
  if (!v) return null
  if (/^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/i.test(v)) return { href: v, handle: `@${v.replace(/\/$/, '').split('/').pop()}` }
  const handle = v.replace(/^@/, '')
  return /^[\w.]{1,30}$/.test(handle) ? { href: `https://www.instagram.com/${handle}/`, handle: `@${handle}` } : null
}

/**
 * Programme rows ready to display:
 *   start + end                  → "9:30 – 10:30 am" / "1.15 – 2.15 Petang" (ms locales)
 *   same start as the item above → "… onward"
 *   no time, after timed items   → "Then" / "Seterusnya"
 * `highlight` marks items naming the event itself (e.g. "Akad Nikah"), so the main moment stands out.
 */
export function programmeRows(event, locale) {
  const items = (Array.isArray(event?.programme) ? event.programme : []).filter((p) => str(p?.title))
  const malay = /^ms\b/i.test(locale || '')
  const keyParts = str(event?.title)
    .toLowerCase()
    .split(/[,&]| dan /)
    .map((s) => s.trim())
    .filter((s) => s.length >= 5)
  let sawTime = false
  return items.map((p, i) => {
    const title = str(p.title)
    let when = ''
    if (p.time) {
      const sameAsPrevious = i > 0 && items[i - 1].time === p.time && !p.endTime
      when = sameAsPrevious ? `${formatTime(p.time, locale)} onward` : formatTimeRange(p.time, p.endTime, locale)
      sawTime = true
    } else if (sawTime) {
      when = malay ? 'Seterusnya' : 'Then'
    }
    const lower = title.toLowerCase()
    return { when, title, highlight: keyParts.some((k) => lower.includes(k)) }
  })
}
