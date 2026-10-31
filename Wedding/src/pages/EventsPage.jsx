import { CalendarDays } from 'lucide-react'
import { EventCard } from '../components/home/EventCard.jsx'
import { EmptyState } from '../components/ui/Feedback.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'

export function EventsPage() {
  const { events, content } = useSite()
  return (
    <PageShell eyebrow="Celebrations" title="Wedding Events" intro={content.info.scheduleNote}>
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Details coming soon">
          We are finalising our celebrations. Please check back shortly.
        </EmptyState>
      ) : (
        <div className={`grid gap-6 ${events.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-2xl'}`}>
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} detailed />
          ))}
        </div>
      )}
    </PageShell>
  )
}
