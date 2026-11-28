// Copied from Listing-Sample/Mashoor/portal/src/pages/InspectionsPage.jsx; the
// prototype only adds a live refetch (useLiveVersion) to its two effects.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { formatDate } from '@mashoor/shared/format'
import { useAuth } from '@mashoor/shared/useAuth'
import { InspectionStatusBadge, VehicleTitle } from '@mashoor/shared/InspectionView'
import { Alert, EmptyState, Loading, PageHeader } from '@mashoor/shared/ui'
import { useLiveVersion } from '@prototype/useLive.js'
import { api } from '../api.js'

const QUEUES = {
  inspector: [
    { key: 'assigned', label: 'Assigned', empty: 'No newly assigned inspections.' },
    { key: 'draft', label: 'In progress', empty: 'No checklists in progress.' },
    { key: 'returned', label: 'Re-check requested', empty: 'Nothing has been returned for re-check.' },
    { key: 'submitted', label: 'Submitted', empty: 'You haven’t submitted any inspections yet.' },
  ],
  client: [
    { key: 'pending_verification', label: 'Pending verification', empty: 'No inspections are waiting for your verification.' },
    { key: 'returned', label: 'Re-check requested', empty: 'No inspections are out for re-check.' },
    { key: 'pending_approval', label: 'Awaiting Head of Operation', empty: 'No inspections are waiting for Head of Operation approval.' },
    { key: 'completed', label: 'Completed', empty: 'No approved inspections yet.' },
  ],
}
const SIGNOFFS = { key: 'signoffs', label: 'My sign-offs', empty: 'Nothing is waiting for your sign-off.' }
// Queues whose items wait on this viewer; the same ones the header badge adds up (App.jsx).
const TODO = { inspector: ['assigned', 'draft', 'returned', 'signoffs'], client: ['pending_verification', 'signoffs'] }

// Row button names the viewer's next step; it is primary only when the step is theirs.
const NEXT_STEP = {
  inspector: { assigned: 'Start', draft: 'Continue', returned: 'Continue' },
  client: { pending_verification: 'Review' },
}
function RowAction({ role, queue, inspection }) {
  const label = queue === 'signoffs' ? 'Sign' : NEXT_STEP[role]?.[inspection.status]
  return (
    <Link className={`btn btn-sm${label ? ' btn-primary' : ''}`} to={`/inspections/${inspection.id}`}>
      {label ?? 'View'}
    </Link>
  )
}

export default function InspectionsPage() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [counts, setCounts] = useState(null)
  const [stages, setStages] = useState(session.signatoryStages ?? [])
  const [loaded, setLoaded] = useState(null) // { key, inspections }
  const [error, setError] = useState('')
  const role = session.user.role
  // Refetch queue counts and the list when an inspection changes (Socket.IO /mashoor).
  const live = useLiveVersion()
  // Signers with something to sign get "My sign-offs" as the first, default tab.
  const signoffsFirst = stages.length > 0 && counts?.signoffs > 0
  const queues = stages.length ? (signoffsFirst ? [SIGNOFFS, ...QUEUES[role]] : [...QUEUES[role], SIGNOFFS]) : QUEUES[role]
  const requested = params.get('queue')
  // With no tab in the URL a signer's default depends on the counts: wait for them so the tab doesn't jump.
  const active = queues.find((q) => q.key === requested) ?? (stages.length && !requested && !counts ? null : queues[0])
  const activeKey = active?.key
  // A list loaded for another tab counts as still loading.
  const list = active && loaded?.key === activeKey ? loaded.inspections : null

  // One-off message handed over by the inspection page (e.g. after submitting);
  // dropped from the history entry so a refresh doesn't show it again.
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(location.state?.notice ?? null)
  useEffect(() => {
    if (location.state?.notice) navigate({ search: location.search }, { replace: true, state: null })
  }, [location.state, location.search, navigate])

  // On narrow screens the tab row scrolls: keep the selected tab in view (only the row scrolls, not the page).
  const tabRow = useRef(null)
  useEffect(() => {
    tabRow.current?.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' })
  }, [activeKey])

  useEffect(() => {
    api('/inspections/counts').then(
      (d) => {
        setCounts(d.counts)
        setStages(d.signatoryStages)
      },
      () => {},
    )
  }, [activeKey, live.version])

  useEffect(() => {
    if (!activeKey) return undefined
    let cancelled = false
    api(`/inspections?queue=${activeKey}`).then(
      (d) => {
        if (cancelled) return
        setLoaded({ key: activeKey, inspections: d.inspections })
        setError('')
      },
      (err) => !cancelled && setError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [activeKey, live.version])

  return (
    <>
      <PageHeader
        title="Inspections"
        description={
          role === 'inspector'
            ? 'Vehicle checklists assigned to you. Save drafts as you go and submit them for client verification.'
            : `Vehicle inspections for ${session.company.name}: verify submitted checklists and follow them to Head of Operation approval.`
        }
      />
      {notice && (
        <Alert tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
          {notice.body}
        </Alert>
      )}
      <section className="card" aria-label="Inspection lists">
        <nav ref={tabRow} className="tabs" aria-label="Inspection lists" style={{ padding: '0 1.5rem' }}>
          {queues.map((q) => (
            <Link
              key={q.key}
              to={`/inspections?queue=${q.key}`}
              className={`tab${q.key === activeKey ? ' active' : ''}`}
              aria-current={q.key === activeKey ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setParams({ queue: q.key })
              }}
            >
              {q.label}
              {counts && counts[q.key] !== undefined && (
                <span className={`count${counts[q.key] > 0 && TODO[role]?.includes(q.key) ? ' todo' : ''}`}>{counts[q.key]}</span>
              )}
            </Link>
          ))}
        </nav>
        {error && <EmptyState tone="error" title="Inspections couldn’t load">{error}</EmptyState>}
        {!list && !error && <Loading />}
        {list?.length === 0 && <EmptyState icon="inbox" title="Nothing here">{active?.empty}</EmptyState>}
        {list?.length > 0 && (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Status</th>
                  <th scope="col">{role === 'inspector' ? 'Checklist' : 'Inspector'}</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className="visually-hidden">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td data-label="">
                      <span className="cell-main">
                        <Link className="cell-title" to={`/inspections/${i.id}`}>
                          <VehicleTitle vehicle={i.vehicle} />
                        </Link>
                        <span className="cell-sub">
                          {[i.vehicle.registrationNo && `Reg. ${i.vehicle.registrationNo}`, i.vehicle.modRegistrationNo && `MOD ${i.vehicle.modRegistrationNo}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {i.status === 'returned' && i.recheckReason && (
                          <span className="cell-sub clamp-2" style={{ color: 'var(--danger)' }}>
                            Re-check: {i.recheckReason}
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Status">
                      <InspectionStatusBadge status={i.status} />
                    </td>
                    <td data-label={role === 'inspector' ? 'Checklist' : 'Inspector'}>
                      {/* One element, so the stacked phone layout keeps it on one line; revision shown only once there is more than one. */}
                      <span>
                        {role === 'inspector' ? i.templateName : (i.inspector?.name ?? '—')}
                        {i.currentRevision > 1 && <span className="subtle"> · revision {i.currentRevision}</span>}
                      </span>
                    </td>
                    <td data-label="Updated" className="subtle num">
                      {formatDate(i.updatedAt)}
                    </td>
                    <td data-label="" className="col-actions">
                      <RowAction role={role} queue={activeKey} inspection={i} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
