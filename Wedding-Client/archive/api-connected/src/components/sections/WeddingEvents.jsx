// Event cards: a date column, title, time, venue, dress code, description,
// the programme, and Directions / Add-to-calendar actions. One event gets a
// wide two-column card; several sit side by side.
import { Clock, MapPin, Navigation, Shirt } from 'lucide-react'
import { useSite } from '../../context/SiteContext.jsx'
import { mapsLink } from '../../lib/content.js'
import { labels } from '../../lib/labels.js'
import { formatDate, formatTimeRange } from '../../lib/time.js'
import { CalendarMenu } from '../events/CalendarMenu.jsx'
import { ProgrammeList } from '../events/ProgrammeList.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

function Meta({ icon: Icon, children }) {
  return (
    <div className="flex gap-3 text-[0.95rem] leading-relaxed">
      <Icon className="mt-1 size-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EventCard({ event, locale, timeZone, wide, delay = 0 }) {
  const L = labels(locale)
  const map = mapsLink(event)
  const hasProgramme = (event.programme ?? []).some((p) => p?.title)
  return (
    <Reveal delay={delay} as="article" className={`overflow-hidden rounded-[1.5rem] border border-linen bg-white shadow-lift ${wide ? 'md:grid md:grid-cols-[13rem_1fr]' : ''}`}>
      {/* date column */}
      <div className="relative flex items-center justify-center gap-4 bg-espresso px-6 py-7 text-center text-ivory md:flex-col md:gap-1 md:py-10">
        {event.event_date ? (
          <>
            <span className="text-[0.66rem] font-semibold tracking-[0.3em] text-champagne/90 uppercase">{formatDate(event.event_date, locale, { weekday: 'long' })}</span>
            <span className="font-display text-5xl leading-none md:text-7xl">{formatDate(event.event_date, locale, { day: 'numeric' })}</span>
            <span className="text-[0.66rem] font-semibold tracking-[0.3em] text-champagne/90 uppercase">{formatDate(event.event_date, locale, { month: 'long', year: 'numeric' })}</span>
          </>
        ) : (
          <span className="text-xs tracking-[0.3em] uppercase">Date to be announced</span>
        )}
      </div>

      <div className="p-6 sm:p-9">
        <h3 className="text-xl leading-snug tracking-[0.1em] text-balance uppercase sm:text-2xl">{event.title}</h3>
        {event.description && <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{event.description}</p>}

        <div className="mt-6 space-y-3.5">
          {event.start_time && (
            <Meta icon={Clock}>
              <span className="font-medium text-ink">{formatTimeRange(event.start_time, event.end_time, locale)}</span>
            </Meta>
          )}
          {(event.venue_name || event.address) && (
            <Meta icon={MapPin}>
              {event.venue_name && <p className="font-medium text-ink">{event.venue_name}</p>}
              {event.address && <p className="whitespace-pre-line text-muted">{event.address}</p>}
            </Meta>
          )}
          {event.dress_code && (
            <Meta icon={Shirt}>
              <span className="text-muted">{L.dressCode}: </span>
              <span className="text-ink">{event.dress_code}</span>
            </Meta>
          )}
        </div>

        {hasProgramme && (
          <div className="mt-8 rounded-2xl bg-cream/70 px-3 py-5 sm:px-5">
            <p className="eyebrow mb-2 text-center">{L.programme}</p>
            <ProgrammeList event={event} locale={locale} />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {map && (
            <a href={map} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Navigation className="size-4" aria-hidden="true" /> {L.directions}
            </a>
          )}
          <CalendarMenu event={event} timeZone={timeZone} label={L.addToCalendar} />
        </div>
      </div>
    </Reveal>
  )
}

export function WeddingEvents({ id = 'events', title = 'Wedding Events' }) {
  const { events, locale, settings, content } = useSite()
  if (!events.length) return null
  const single = events.length === 1
  return (
    <Section id={id} tone="beige">
      <SectionTitle kicker={labels(locale).eventsKicker} title={title}>
        {content.info.scheduleNote && <p>{content.info.scheduleNote}</p>}
      </SectionTitle>
      <div className={`mx-auto mt-14 grid gap-8 ${single ? 'max-w-4xl' : 'max-w-6xl lg:grid-cols-2'}`}>
        {events.map((event, i) => (
          <EventCard key={event.id} event={event} locale={locale} timeZone={settings.timezone} wide={single} delay={i * 0.08} />
        ))}
      </div>
    </Section>
  )
}
