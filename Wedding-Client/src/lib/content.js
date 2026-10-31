// Pure helpers over src/data/weddingData.js.

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** "Naqiuddin & Syafina": the short names for decorative headings. */
export const coupleShort = (couple) => `${couple.groom.short} & ${couple.bride.short}`

/** "N & S": the monogram. */
export const coupleMonogram = (couple) => `${couple.groom.initial} & ${couple.bride.initial}`

/** The full address as one line (exactly as supplied). */
export const venueAddress = (venue) => (venue?.addressLines ?? []).join(' ')

/** The venue's own map link, else a Google Maps search for its name and address (no API key needed). */
export function mapsLink(venue) {
  if (/^https:\/\//i.test(str(venue?.mapsUrl))) return venue.mapsUrl
  const q = [venue?.name, venueAddress(venue)].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''
}

/**
 * The majlis as a calendar entry (shape lib/calendar.js expects). It starts at
 * the confirmed reception time; no end time is invented.
 */
export const calendarEvent = (event, venue, couple) => ({
  id: 'majlis',
  title: couple ? `${coupleShort(couple)} · ${event.title}` : event.title,
  description: [couple && `${couple.groom.fullName} & ${couple.bride.fullName}`, `${event.day}, ${event.dateText} · ${event.hijriDate}`].filter(Boolean).join('\n'),
  event_date: event.date,
  start_time: event.startTime,
  end_time: null,
  venue_name: venue?.name,
  address: venueAddress(venue),
})
