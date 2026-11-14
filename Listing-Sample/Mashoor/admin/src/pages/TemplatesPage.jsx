import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatDay } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { VEHICLE_TYPES } from '@mashoor/shared/inspection'
import { Alert, EmptyState, Loading, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { StatusBadge } from './StatusBadge.jsx'

export default function TemplatesPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/checklist-templates').then(setData, (err) => setError(err.message))
  }, [])

  const byType = Object.fromEntries(VEHICLE_TYPES.map((t) => [t, (data?.templates ?? []).filter((x) => x.vehicleType === t)]))

  return (
    <>
      <PageHeader
        title="Checklist templates"
        description="The vehicle checklist forms inspectors fill in, per vehicle type. Edit a draft, preview it, then publish it as a new version — inspections already created keep the version they started with."
        actions={
          <Link className="btn btn-primary" to="/templates/new">
            <Icon name="plus" /> New template
          </Link>
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && (
        <div className="card">
          <Loading />
        </div>
      )}
      {data &&
        VEHICLE_TYPES.map((type) => (
          <section key={type} className="card" aria-label={type}>
            <div className="card-head">
              <div>
                <h2>{type}</h2>
                <p>{byType[type].length ? `${byType[type].length} template${byType[type].length === 1 ? '' : 's'}` : 'No template yet'}</p>
              </div>
              <Link className="btn btn-sm" to={`/templates/new?type=${encodeURIComponent(type)}`}>
                <Icon name="plus" /> Add
              </Link>
            </div>
            {byType[type].length === 0 ? (
              <EmptyState icon="layers" title={`No ${type} checklist yet`}>
                Inspections for this vehicle type can’t be created until a checklist template is published.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table table-stack">
                  <thead>
                    <tr>
                      <th scope="col">Template</th>
                      <th scope="col">Published</th>
                      <th scope="col">Draft</th>
                      <th scope="col">Used by</th>
                      <th scope="col">State</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {byType[type].map((t) => (
                      <tr key={t.id}>
                        <td data-label="">
                          <span className="cell-main">
                            <Link className="cell-title" to={`/templates/${t.id}`}>
                              {t.name}
                            </Link>
                            {t.imported && <span className="cell-sub">Imported from the client’s MOD checklist PDF</span>}
                          </span>
                        </td>
                        <td data-label="Published" className="num">
                          {t.current ? (
                            <>
                              v{t.current.version} · {t.current.itemCount} items
                              <span className="subtle"> · {formatDay(t.current.publishedAt)}</span>
                            </>
                          ) : (
                            <span className="badge warning">Not published</span>
                          )}
                        </td>
                        <td data-label="Draft">{t.draft ? <span className="badge accent">v{t.draft.version} draft</span> : <span className="muted">—</span>}</td>
                        <td data-label="Used by" className="num">
                          {t.inspectionCount} inspection{t.inspectionCount === 1 ? '' : 's'}
                        </td>
                        <td data-label="State">
                          <StatusBadge active={t.active} inactiveTone="" />
                        </td>
                        <td data-label="" className="col-actions">
                          <Link className="btn btn-sm" to={`/templates/${t.id}`}>
                            <Icon name="edit" /> Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
    </>
  )
}
