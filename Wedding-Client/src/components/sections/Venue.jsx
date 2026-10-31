// Tempat Majlis: venue name, the full address, the date and time, and a
// Google Maps directions link (a normal link — no API key needed), set in an
// arch-topped invitation card. The venue photo shows only once it's added.
import { Clock, MapPin, Navigation } from 'lucide-react'
import { weddingData } from '../../data/weddingData.js'
import { mapsLink } from '../../lib/content.js'
import { FloralCorner } from '../decor/Floral.jsx'
import { ArchPanel } from '../ui/ArchPanel.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

export function Venue() {
  const { venue, event } = weddingData
  const map = mapsLink(venue)
  return (
    <Section id="tempat" tone="tint">
      <SectionTitle eyebrow="Lokasi" title="Tempat Majlis" />

      <Reveal className="relative mx-auto mt-14 max-w-xl">
        <FloralCorner position="bottom-left" className="absolute -bottom-8 -left-3 z-10 sm:-bottom-10 sm:-left-20" size="w-24 sm:w-40" />
        <FloralCorner position="bottom-right" className="absolute -right-3 -bottom-8 z-10 sm:-right-20 sm:-bottom-10" size="w-24 sm:w-40" />
        <ArchPanel bodyClassName="pb-14">
          <SmartImage src={venue.image} alt={venue.name} loading="lazy" className="arch mx-auto mb-8 aspect-[4/5] w-3/5 max-w-60 object-cover" />
          <MapPin className="mx-auto size-6 text-floral" strokeWidth={1.4} aria-hidden="true" />
          <h3 className="mt-4 font-display text-[1.45rem] leading-snug tracking-[0.12em] text-balance text-primary uppercase sm:text-[1.7rem]">{venue.name}</h3>
          <address className="mx-auto mt-5 max-w-sm text-[0.9rem] leading-[1.8] text-muted not-italic">
            {venue.addressLines.map((line) => (
              <span key={line} className="block text-balance">
                {line}
              </span>
            ))}
          </address>
          <div className="mx-auto mt-6 w-full max-w-sm border-y border-line py-4">
            <p className="font-display text-[0.95rem] tracking-[0.14em] text-ink uppercase">
              {event.day}, {event.dateText}
            </p>
            <p className="mt-1.5 flex items-center justify-center gap-1.5 font-serif text-lg text-bronze-deep italic">
              <Clock className="size-3.5" aria-hidden="true" /> Menerima Jemputan {event.startTimeText}
            </p>
          </div>
          {map && (
            <div className="mt-8">
              <a href={map} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <Navigation className="size-3.5" aria-hidden="true" /> Dapatkan Arah
              </a>
              <p className="mt-2.5 text-xs text-muted">Dibuka di Google Maps</p>
            </div>
          )}
        </ArchPanel>
      </Reveal>
    </Section>
  )
}
