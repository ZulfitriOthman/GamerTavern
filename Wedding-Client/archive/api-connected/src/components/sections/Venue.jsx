// The venue: name, full address, date & time, directions, and a map.
// The Google map is only loaded when a guest taps "Show map" — no API key, no
// third-party requests until then, and a lighter page on phones.
import { Map as MapIcon, Navigation } from 'lucide-react'
import { useState } from 'react'
import { LOCAL_IMAGES } from '../../config/images.js'
import { useSite } from '../../context/SiteContext.jsx'
import { venueEvent } from '../../hooks/useSiteSections.js'
import { mapEmbedUrl, mapsLink } from '../../lib/content.js'
import { labels } from '../../lib/labels.js'
import { formatDate, formatTimeRange } from '../../lib/time.js'
import { CalendarMenu } from '../events/CalendarMenu.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Ornament, Section } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

export function Venue() {
  const { events, locale, settings } = useSite()
  const L = labels(locale)
  const [showMap, setShowMap] = useState(false)
  const event = venueEvent(events)
  if (!event) return null
  const map = mapsLink(event)
  const embed = mapEmbedUrl(event)

  return (
    <Section id="venue" tone="dark" className="isolate">
      <SmartImage sources={[LOCAL_IMAGES.venue]} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover opacity-35" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-espresso via-espresso/90 to-espresso/70" aria-hidden="true" />

      <div className="mx-auto grid max-w-6xl items-stretch gap-8 lg:grid-cols-[1fr_1.15fr]">
        <Reveal className="flex flex-col justify-center rounded-[1.5rem] bg-ivory px-6 py-12 text-center text-ink shadow-lift sm:px-12">
          <p className="font-script text-4xl leading-none text-gold">{L.venueKicker}</p>
          <h2 className="mt-3 text-2xl leading-snug tracking-[0.12em] text-balance uppercase sm:text-[2.1rem]">{event.venue_name || L.venue}</h2>
          <Ornament className="mt-5" />
          {event.address && <p className="mx-auto mt-6 max-w-sm leading-relaxed whitespace-pre-line text-muted text-balance">{event.address}</p>}
          {event.event_date && (
            <div className="mt-7 border-y border-linen py-4">
              <p className="font-display tracking-[0.14em] uppercase">{formatDate(event.event_date, locale)}</p>
              {event.start_time && <p className="mt-1 text-sm text-gold-deep">{formatTimeRange(event.start_time, event.end_time, locale)}</p>}
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <Navigation className="size-4" aria-hidden="true" /> {L.directions}
              </a>
            )}
            <CalendarMenu event={event} timeZone={settings.timezone} label={L.addToCalendar} />
          </div>
        </Reveal>

        <Reveal delay={0.1} className="relative min-h-80 overflow-hidden rounded-[1.5rem] border border-ivory/15 bg-espresso/60">
          {showMap && embed ? (
            <iframe
              title={`Map of ${event.venue_name || 'the venue'}`}
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0 [filter:sepia(0.25)_saturate(0.85)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
              {/* stylised map lines, purely decorative */}
              <svg className="absolute inset-0 size-full text-ivory/10" aria-hidden="true">
                <defs>
                  <pattern id="venue-grid" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
                    <path d="M0 22h44M22 0v44" stroke="currentColor" strokeWidth="1" fill="none" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#venue-grid)" />
              </svg>
              <span className="relative grid size-16 place-items-center rounded-full border border-champagne/50 text-champagne">
                <MapIcon className="size-7" strokeWidth={1.3} aria-hidden="true" />
              </span>
              <p className="relative max-w-xs text-sm text-ivory/75">{event.venue_name}</p>
              {embed && (
                <button type="button" className="btn-light relative" onClick={() => setShowMap(true)}>
                  {L.openMap}
                </button>
              )}
              <p className="relative max-w-xs text-[0.7rem] text-ivory/50">Loads Google Maps.</p>
            </div>
          )}
        </Reveal>
      </div>
    </Section>
  )
}
