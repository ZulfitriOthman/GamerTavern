import { Link } from 'react-router-dom'
import { LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { formatDate } from '../../lib/time.js'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchStats } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { StatCard } from '../components/shared.jsx'

export function OverviewPage() {
  const { content, settingsMissing } = useSite()
  const { data: s, error, loading } = useAsync(fetchStats, [])

  return (
    <>
      <AdminHeader title="Overview" description="A snapshot of your guests and their responses." />
      {settingsMissing && (
        <Notice tone="warning" className="mb-6" title="Settings row missing">
          Run <code>database/seeds/001_wedding_information.sql</code> in MySQL Workbench so the website settings row, event and albums exist.
        </Notice>
      )}
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <Notice tone="error">{friendlyError(error)}</Notice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Invited parties" value={s.invited_parties} hint={`${s.invited_seats} seats offered`} />
            <StatCard label="Responses" value={s.responding_parties} hint={`${s.responses} event replies`} />
            <StatCard label="Attending replies" value={s.attending_responses} />
            <StatCard label="Declined replies" value={s.declined_responses} />
            <StatCard label="Expected guests" value={s.expected_attendees} hint="Sum across all events" accent />
            <Link to="/admin/wishes" className="contents">
              <StatCard label="Older pending wishes" value={s.pending_greetings} accent={s.pending_greetings > 0} hint="From before instant publishing" />
            </Link>
            <Link to="/admin/photos" className="contents">
              <StatCard label="Older pending photos" value={s.pending_photos} accent={s.pending_photos > 0} hint="From before instant publishing" />
            </Link>
          </div>

          <h2 className="mt-10 mb-4 text-2xl">By event</h2>
          {s.events.length === 0 ? (
            <p className="text-sm text-muted">
              No events yet. <Link to="/admin/events" className="text-gold-deep underline">Add your first event</Link>.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {s.events.map((e) => {
                const pct = e.capacity ? Math.min(100, Math.round((e.attending / e.capacity) * 100)) : null
                return (
                  <div key={e.id} className="rounded-3xl border border-champagne bg-white/70 p-5">
                    <p className="font-serif text-2xl">{e.title}</p>
                    <p className="text-xs text-muted">{e.event_date ? formatDate(e.event_date, content.locale) : 'No date set'}</p>
                    <div className="mt-4 flex gap-6 text-sm">
                      <span>
                        <strong className="font-serif text-2xl text-sage-deep">{e.attending}</strong> attending
                      </span>
                      <span>
                        <strong className="font-serif text-2xl text-muted">{e.declined}</strong> declined
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-cream">
                          <div className={`h-full ${pct >= 90 ? 'bg-rose' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {e.attending} / {e.capacity} capacity
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
