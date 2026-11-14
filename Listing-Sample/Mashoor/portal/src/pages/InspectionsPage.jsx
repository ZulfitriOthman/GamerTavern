import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDate } from '@mashoor/shared/format'
import { useAuth } from '@mashoor/shared/useAuth'
import { InspectionStatusBadge, VehicleTitle } from '@mashoor/shared/InspectionView'
import { EmptyState, Loading, PageHeader } from '@mashoor/shared/ui'
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
    { key: 'pending_approval', label: 'Awaiting HOO approval', empty: 'No inspections are waiting for Head of Operation approval.' },
    { key: 'completed', label: 'Completed', empty: 'No approved inspections yet.' },
  ],
}
const SIGNOFFS = { key: 'signoffs', label: 'My sign-offs', empty: 'Nothing is waiting for your sign-off.' }

export default function InspectionsPage() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [counts, setCounts] = useState(null)
  const [stages, setStages] = useState(session.signatoryStages ?? [])
  const [loaded, setLoaded] = useState(null) // { key, inspections }
  const [error, setError] = useState('')
  const role = session.user.role
  const queues = [...QUEUES[role], ...(stages.length ? [SIGNOFFS] : [])]
  const active = queues.find((q) => q.key === params.get('queue')) ?? queues[0]
  // A list loaded for another tab counts as still loading.
  const list = loaded?.key === active.key ? loaded.inspections : null

  useEffect(() => {
    api('/inspections/counts').then(
      (d) => {
        setCounts(d.counts)
        setStages(d.signatoryStages)
      },
      () => {},
    )
  }, [active.key])

  useEffect(() => {
    let cancelled = false
    api(`/inspections?queue=${active.key}`).then(
      (d) => {
        if (cancelled) return
        setLoaded({ key: active.key, inspections: d.inspections })
        setError('')
      },
      (err) => !cancelled && setError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [active.key])

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
      <section className="card" aria-label="Inspection lists">
        <nav className="tabs" aria-label="Inspection lists" style={{ padding: '0 1.5rem' }}>
          {queues.map((q) => (
            <Link
              key={q.key}
              to={`/inspections?queue=${q.key}`}
              className={`tab${q.key === active.key ? ' active' : ''}`}
              aria-current={q.key === active.key ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setParams({ queue: q.key })
              }}
            >
              {q.label}
              {counts && counts[q.key] !== undefined && <span className="count">{counts[q.key]}</span>}
            </Link>
          ))}
        </nav>
        {error && <EmptyState tone="error" title="Inspections couldn’t load">{error}</EmptyState>}
        {!list && !error && <Loading />}
        {list?.length === 0 && <EmptyState icon="inbox" title="Nothing here">{active.empty}</EmptyState>}
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
                      {role === 'inspector' ? i.templateName : (i.inspector?.name ?? '—')}
                      {i.currentRevision > 0 && <span className="subtle"> · rev. {i.currentRevision}</span>}
                    </td>
                    <td data-label="Updated" className="subtle num">
                      {formatDate(i.updatedAt)}
                    </td>
                    <td data-label="" className="col-actions">
                      <Link className="btn btn-sm" to={`/inspections/${i.id}`}>
                        Open
                      </Link>
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
