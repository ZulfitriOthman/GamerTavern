import { CalendarPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { downloadIcs, googleCalendarUrl } from '../../lib/calendar.js'

/** "Add to calendar" with Google and .ics (Apple / Outlook) options. Escape or an outside click closes it. */
export function CalendarMenu({ event, timeZone, label, className = 'btn-outline' }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => (e.type === 'keydown' ? e.key === 'Escape' : !root.current?.contains(e.target)) && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  if (!event?.event_date) return null
  return (
    <div ref={root} className="relative">
      <button type="button" className={className} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <CalendarPlus className="size-4" aria-hidden="true" /> {label}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-linen bg-white text-left text-sm text-ink normal-case shadow-lift">
          <a role="menuitem" href={googleCalendarUrl(event, timeZone)} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-cream" onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <button
            role="menuitem"
            type="button"
            className="block w-full px-4 py-3 text-left hover:bg-cream"
            onClick={() => {
              downloadIcs(event, timeZone)
              setOpen(false)
            }}
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  )
}
