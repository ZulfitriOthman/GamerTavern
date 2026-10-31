import { CalendarPlus, Clock, MapPin, Navigation, Shirt } from 'lucide-react'
import { useSite } from '../../context/SiteContext.jsx'
import { buildIcs, googleCalendarLink, mapsLink } from '../../lib/calendar.js'
import { downloadText } from '../../lib/csv.js'
import { formatDate, formatTime, formatTimeRange } from '../../lib/time.js'
import { Reveal } from '../ui/Reveal.jsx'

export function EventCard({ event, index = 0, detailed = false }) {
  const { content, settings, coupleTitle } = useSite()
  const locale = content.locale
  const directions = mapsLink(event)
  const gcal = event.event_date ? googleCalendarLink(event, settings.timezone, coupleTitle) : ''
  const programme = Array.isArray(event.programme) ? event.programme.filter((p) => p?.title) : []

  const saveIcs = () => {
    const ics = buildIcs(event, settings.timezone, coupleTitle)
    if (ics) downloadText(`${event.title.replace(/[^\w-]+/g, '-').toLowerCase()}.ics`, ics, 'text/calendar;charset=utf-8')
  }

  return (
    <Reveal delay={index * 0.08} className="card relative flex h-full flex-col overflow-hidden p-7 sm:p-9">
      <div className="pointer-events-none absolute -top-20 -right-20 size-44 rounded-full bg-champagne/50 blur-2xl" aria-hidden="true" />
      <p className="eyebrow">{event.event_date ? formatDate(event.event_date, locale, { day: undefined, month: undefined, year: undefined }) : 'Date to be announced'}</p>
      <h3 className="mt-3 text-3xl sm:text-4xl">{event.title}</h3>
      {event.event_date && (
        <p className="mt-1 font-serif text-2xl font-medium text-gold-deep italic">{formatDate(event.event_date, locale, { weekday: undefined })}</p>
      )}

      <dl className="mt-6 space-y-4 text-base">
        {event.start_time && (
          <div className="flex gap-3">
            <dt>
              <Clock className="mt-1 size-5 text-gold-deep" aria-label="Time" />
            </dt>
            <dd className="font-medium text-ink">{formatTimeRange(event.start_time, event.end_time, locale)}</dd>
          </div>
        )}
        {(event.venue_name || event.address) && (
          <div className="flex gap-3">
            <dt>
              <MapPin className="mt-1 size-5 text-gold-deep" aria-label="Venue" />
            </dt>
            <dd>
              {event.venue_name && <span className="block font-semibold text-ink">{event.venue_name}</span>}
              {event.address && <span className="block whitespace-pre-line text-muted">{event.address}</span>}
            </dd>
          </div>
        )}
        {event.dress_code && (
          <div className="flex gap-3">
            <dt>
              <Shirt className="mt-1 size-5 text-gold-deep" aria-label="Dress code" />
            </dt>
            <dd className="text-muted">{event.dress_code}</dd>
          </div>
        )}
      </dl>

      {detailed && event.description && <p className="mt-5 text-base leading-[1.7] whitespace-pre-line text-muted">{event.description}</p>}

      {detailed && programme.length > 0 && (
        <div className="mt-7">
          <p className="eyebrow">Programme</p>
          <ol className="mt-4 space-y-0 border-l border-champagne">
            {programme.map((item, i) => (
              <li key={i} className="relative pb-4 pl-5 last:pb-0">
                <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border border-gold bg-ivory" aria-hidden="true" />
                {item.time && (
                  <span className="mr-2 text-sm font-semibold tracking-[0.08em] text-gold-deep uppercase">
                    {formatTime(item.time, locale) || item.time}
                    {item.endTime && ` – ${formatTime(item.endTime, locale) || item.endTime}`}
                  </span>
                )}
                <span className="text-base text-ink">{item.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-7">
        {directions && (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
            <Navigation className="size-3.5" /> Directions
          </a>
        )}
        {gcal && (
          <>
            <a href={gcal} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              <CalendarPlus className="size-3.5" /> Google Calendar
            </a>
            <button type="button" onClick={saveIcs} className="btn-ghost btn-sm">
              <CalendarPlus className="size-3.5" /> Apple / Outlook
            </button>
          </>
        )}
      </div>
    </Reveal>
  )
}
