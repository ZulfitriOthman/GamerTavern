import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { vehicleTitle } from '@mashoor/shared/inspection'
import { Icon } from '@mashoor/shared/Icon'
import { ChecklistForm } from '@mashoor/shared/ChecklistForm'
import {
  EventTimeline,
  InspectionStatusBadge,
  RevisionHistory,
  SignoffPanel,
  SummarySection,
  VehicleCard,
} from '@mashoor/shared/InspectionView'
import { Alert, EmptyState, Field, Loading, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { diagramUrl } from '../diagramUrl.js'

const EDITABLE = ['assigned', 'draft', 'returned']

// Staff view: read-only workflow state, plus reassignment / identifier
// corrections while the checklist is still with the inspector.
export default function InspectionDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api(`/inspections/${id}`).then(
      (d) => {
        if (cancelled) return
        setData(d)
        setLoadError(null)
      },
      (err) => !cancelled && setLoadError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const back = { to: '/inspections', label: 'Inspections' }
  if (loadError) {
    return (
      <>
        <PageHeader title="Inspection" back={back} />
        <div className="card">
          <EmptyState tone="error" title={loadError.status === 404 ? 'Inspection not found' : 'This inspection couldn’t load'}>
            {loadError.message}
          </EmptyState>
        </div>
      </>
    )
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Inspection" back={back} />
        <div className="card">
          <Loading />
        </div>
      </>
    )
  }

  const { inspection, inspectors } = data
  const current = inspection.revisions.find((r) => r.current)
  const editable = EDITABLE.includes(inspection.status)

  async function handleUpdate(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api(`/inspections/${id}`, {
        method: 'PATCH',
        body: {
          inspectorId: Number(form.get('inspectorId')),
          vehiclePlate: form.get('vehiclePlate'),
          vehicleRegistrationNo: form.get('vehicleRegistrationNo'),
          modRegistrationNo: form.get('modRegistrationNo'),
        },
      })
      setNotice('Inspection updated.')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        back={back}
        title={vehicleTitle(inspection.vehicle)}
        badge={<InspectionStatusBadge status={inspection.status} />}
        description={`${inspection.company.name} · ${inspection.templateName}${inspection.templateVersion ? ` (template v${inspection.templateVersion})` : ''}${
          inspection.currentRevision ? ` · revision ${inspection.currentRevision}` : ''
        }`}
        actions={
          <Link className="btn" to={`/inspections/${inspection.id}/print`}>
            <Icon name="eye" /> Print view
          </Link>
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {inspection.recheckReason && (
        <Alert tone="warning" title="Re-check requested">
          <span className="prewrap">{inspection.recheckReason}</span>
        </Alert>
      )}

      <div className="split form-split">
        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>
          <Alert tone="info">
            {current
              ? `Revision ${current.revision}, exactly as ${current.submittedBy?.name ?? 'the inspector'} submitted it.`
              : 'Not submitted yet — this is the inspector’s current draft and may still change.'}
          </Alert>
          <ChecklistForm
            readOnly
            definition={current ? current.snapshot.definition : inspection.working.definition}
            answers={current ? current.snapshot.answers : inspection.working.answers}
            vehicle={current ? current.snapshot.vehicle : inspection.vehicle}
            diagramUrl={diagramUrl((current ? current.snapshot.definition : inspection.working.definition).damage?.diagramId)}
          />
          {current && <SummarySection summary={current.summary} vehicle={current.snapshot.vehicle} />}
          <SignoffPanel inspection={inspection} revision={current} captions={(current ? current.snapshot.definition : inspection.working.definition).signoff} />
        </div>
        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>
          <VehicleCard inspection={inspection} />
          {editable && (
            <section className="card" aria-labelledby="assign-title">
              <div className="card-head">
                <div>
                  <h2 id="assign-title">Assignment</h2>
                  <p>Can be changed while the checklist is with the inspector.</p>
                </div>
              </div>
              <form className="card-body form-stack" onSubmit={handleUpdate} key={inspection.updatedAt}>
                <Field label="Inspector">
                  <select className="select" name="inspectorId" defaultValue={inspection.inspector.id}>
                    {!inspectors.some((u) => u.id === inspection.inspector.id) && (
                      <option value={inspection.inspector.id}>{inspection.inspector.name} (no longer an active inspector)</option>
                    )}
                    {inspectors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.username}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Vehicle plate" optional>
                  <input className="input" name="vehiclePlate" defaultValue={inspection.vehicle.plate ?? ''} maxLength={60} />
                </Field>
                <Field label="Vehicle registration no." optional>
                  <input className="input" name="vehicleRegistrationNo" defaultValue={inspection.vehicle.registrationNo ?? ''} maxLength={60} />
                </Field>
                <Field label="MOD registration no." optional>
                  <input className="input" name="modRegistrationNo" defaultValue={inspection.vehicle.modRegistrationNo ?? ''} maxLength={60} />
                </Field>
                <div className="form-actions start">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>
          )}
          <section className="card" aria-labelledby="history-title">
            <div className="card-head">
              <div>
                <h2 id="history-title">History</h2>
              </div>
            </div>
            <EventTimeline events={inspection.events} />
            {inspection.revisions.some((r) => !r.current) && (
              <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Earlier revisions</h3>
                <RevisionHistory
                  revisions={inspection.revisions}
                  renderLink={(r) => <Link to={`/inspections/${inspection.id}/print?revision=${r.revision}`}>View revision {r.revision}</Link>}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
