import { CalendarCheck, CircleX, Heart, Images, MailCheck, QrCode as QrIcon, Users, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/ui/Feedback.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { formatDate } from '../../lib/time.js'
import { getStats } from '../../services/adminService.js'
import { useAdminAsync } from '../auth.jsx'
import { CopyButton, PageTitle, QrCode, SkeletonRows } from '../components/shared.jsx'
import { num, siteUrl } from '../lib.js'

export default function OverviewPage() {
  const { locale } = useSite()
  const { data: stats, loading, error, reload } = useAdminAsync(getStats)
  const shareUrl = `${siteUrl()}/share`

  const tiles = stats
    ? [
        { label: 'Invited parties', value: stats.invited_parties, sub: `${num(stats.invited_seats)} seats`, icon: Users },
        { label: 'Parties replied', value: stats.responding_parties, sub: `${num(stats.responses)} event replies`, icon: MailCheck },
        { label: 'Attending replies', value: stats.attending_responses, icon: CalendarCheck, tone: 'sage' },
        { label: 'Declined replies', value: stats.declined_responses, icon: CircleX },
        { label: 'Expected guests', value: stats.expected_attendees, icon: UsersRound, tone: 'gold' },
        { label: 'Pending wishes', value: stats.pending_greetings, icon: Heart, to: '/admin/wishes' },
        { label: 'Pending photos', value: stats.pending_photos, icon: Images, to: '/admin/photos' },
      ]
    : []

  return (
    <>
      <PageTitle title="Overview" description="A snapshot of replies, wishes and shared memories." />
      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !stats && <SkeletonRows rows={3} />}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {tiles.map((t) => (
              <Tile key={t.label} {...t} />
            ))}
          </div>

          <section className="card mt-6 overflow-hidden">
            <h2 className="border-b border-champagne/70 px-5 py-4 font-serif text-2xl">By event</h2>
            {stats.events?.length ? (
              <ul className="divide-y divide-champagne/60">
                {stats.events.map((e) => {
                  const attending = num(e.attending)
                  const cap = e.capacity ? num(e.capacity) : null
                  return (
                    <li key={e.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="font-medium">{e.title}</p>
                          <p className="text-xs text-muted">{formatDate(e.event_date, locale) || 'Date not set'}</p>
                        </div>
                        <p className="text-sm text-muted tabular-nums">
                          <span className="font-medium text-sage-deep">{attending}</span> attending · {num(e.declined)} declined · {num(e.responses)} replies
                        </p>
                      </div>
                      {cap && (
                        <div className="mt-3">
                          <div className="h-2 overflow-hidden rounded-full bg-linen">
                            <div
                              className={`h-full rounded-full ${attending > cap ? 'bg-rose' : 'bg-gradient-to-r from-sage to-gold'}`}
                              style={{ width: `${Math.min(100, (attending / cap) * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted tabular-nums">
                            {attending} of {cap} seats ({Math.round((attending / cap) * 100)}%)
                          </p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">
                No events yet. <Link to="/admin/events" className="underline underline-offset-4">Add one</Link>.
              </p>
            )}
          </section>
        </>
      )}

      <section className="card mt-6 flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start">
        <QrCode value={shareUrl} size={160} filename="share-your-memories-qr.png" />
        <div className="text-center sm:text-left">
          <p className="eyebrow inline-flex items-center gap-1.5">
            <QrIcon className="size-3.5" aria-hidden="true" /> Photo sharing
          </p>
          <h2 className="mt-1 font-serif text-2xl">QR code for guests</h2>
          <p className="mt-1 max-w-md text-sm text-muted">Print this on table cards so guests can open the “Share your memories” page on their phones.</p>
          <p className="mt-3 text-sm break-all">{shareUrl}</p>
          <div className="mt-3">
            <CopyButton text={shareUrl} label="Copy link" />
          </div>
        </div>
      </section>
    </>
  )
}

function Tile({ label, value, sub, icon: Icon, tone, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">{label}</p>
        <Icon className={`size-4 ${tone === 'sage' ? 'text-sage-deep' : 'text-gold'}`} aria-hidden="true" />
      </div>
      <p className={`mt-2 font-serif text-4xl tabular-nums ${tone === 'gold' ? 'text-gold-deep' : ''}`}>{num(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="card p-4 sm:p-5">{body}</div>
  )
}
