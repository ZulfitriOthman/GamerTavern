// Event cards with an arched top: date, time, venue, dress code, description,
// an expandable programme, and Directions / Add-to-calendar.
import { ChevronDown, Clock, MapPin, Navigation, Shirt } from 'lucide-react'
import { weddingData } from '../../data/weddingData.js'
import { calendarEvent, mapsLink, venueById } from '../../lib/content.js'
import { formatDate, formatTimeRange } from '../../lib/time.js'
import { Sprig } from '../decor/Floral.jsx'
import { CalendarMenu } from '../events/CalendarMenu.jsx'
import { ProgrammeList } from '../events/ProgrammeList.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

function Meta({ icon: Icon, children }) {
  return (
    <div className="flex gap-3 text-left text-[0.92rem] leading-relaxed">
      <Icon className="mt-1 size-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EventCard({ event, delay = 0 }) {
  const { locale, wedding } = weddingData
  const venue = venueById(weddingData, event.venueId)
  const map = mapsLink(venue)
  return (
    <Reveal delay={delay} as="article" className="relative flex h-full flex-col rounded-t-[12rem] rounded-b-3xl border border-linen bg-white px-6 pt-14 pb-8 text-center shadow-lift sm:px-8">
      <div className="pointer-events-none absolute inset-2.5 rounded-t-[11.5rem] rounded-b-[1.2rem] border border-gold/25" aria-hidden="true" />
      <Sprig className="mx-auto w-20" />
      {event.subtitle && <p className="mt-3 font-script text-3xl leading-none text-gold">{event.subtitle}</p>}
      <h3 className="mt-3 font-serif text-[1.9rem] leading-tight font-medium">{event.title}</h3>

      <div className="mx-auto mt-5 flex items-center justify-center gap-3 text-ink">
        <span className="h-px w-6 bg-gold/50" aria-hidden="true" />
        <span className="font-display text-sm tracking-[0.2em] uppercase">{formatDate(event.date, locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span className="h-px w-6 bg-gold/50" aria-hidden="true" />
      </div>

      <div className="mx-auto mt-6 w-full max-w-xs space-y-3">
        <Meta icon={Clock}>{formatTimeRange(event.startTime, event.endTime, locale)}</Meta>
        {venue && (
          <Meta icon={MapPin}>
            <span className="font-medium text-ink">{venue.name}</span>
          </Meta>
        )}
        {event.dressCode && (
          <Meta icon={Shirt}>
            <span className="text-muted">{event.dressCode}</span>
          </Meta>
        )}
      </div>

      {event.description && <p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-muted">{event.description}</p>}

      {event.programme?.length > 0 && (
        <details className="group mt-6 rounded-2xl bg-cream/80 px-3 py-1 text-left">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 py-2.5 text-[0.68rem] font-semibold tracking-[0.24em] text-gold-deep uppercase [&::-webkit-details-marker]:hidden">
            Programme <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="pb-3">
            <ProgrammeList event={event} locale={locale} />
          </div>
        </details>
      )}

      <div className="mt-auto flex flex-wrap justify-center gap-2.5 pt-7">
        {map && (
          <a href={map} target="_blank" rel="noopener noreferrer" className="btn-primary min-h-10 px-5">
            <Navigation className="size-3.5" aria-hidden="true" /> Directions
          </a>
        )}
        <CalendarMenu event={calendarEvent(event, venue)} timeZone={wedding.timeZone} label="Calendar" className="btn-outline min-h-10 px-5" />
      </div>
    </Reveal>
  )
}

export function WeddingEvents() {
  const { events } = weddingData
  return (
    <Section id="events" tone="ivory">
      <SectionTitle eyebrow="Join us" title="Wedding Events">
        <p>We would be honoured to celebrate these moments with you.</p>
      </SectionTitle>
      <div className={`mx-auto mt-16 grid items-stretch gap-10 ${events.length >= 3 ? 'max-w-6xl lg:grid-cols-3' : 'max-w-4xl md:grid-cols-2'} max-lg:max-w-md`}>
        {events.map((event, i) => (
          <EventCard key={event.id} event={event} delay={i * 0.1} />
        ))}
      </div>
    </Section>
  )
}
