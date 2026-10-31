import { CalendarDays } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Venue } from '../components/sections/Venue.jsx'
import { WeddingEvents } from '../components/sections/WeddingEvents.jsx'
import { EmptyState } from '../components/ui/Feedback.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { useSiteSections } from '../hooks/useSiteSections.js'

/** /events — the same event cards and venue as the home page, on their own. */
export default function EventsPage() {
  const { content, events, status, ready } = useSite()
  const visible = useSiteSections()
  if (ready && content.sections.events === false) return <Navigate to="/" replace />

  return (
    <div className="pt-16 sm:pt-[4.5rem]">
      {status === 'loading' ? (
        <div className="mx-auto max-w-4xl px-4 py-28" aria-hidden="true">
          <div className="skeleton h-96" />
        </div>
      ) : ready && events.length === 0 ? (
        <div className="px-4 py-28">
          <EmptyState icon={CalendarDays} title="Event details are coming soon" />
        </div>
      ) : (
        <>
          <WeddingEvents id="events" />
          {visible.venue && <Venue />}
        </>
      )}
    </div>
  )
}
