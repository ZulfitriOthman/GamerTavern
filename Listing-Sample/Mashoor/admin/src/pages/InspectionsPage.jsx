import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { formatDay } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { INSPECTION_STATUS } from '@mashoor/shared/inspection'
import { InspectionStatusBadge, VehicleTitle } from '@mashoor/shared/InspectionView'
import { Alert, EmptyState, Field, Loading, Modal, PageHeader, Pagination } from '@mashoor/shared/ui'
import { api } from '../api.js'

export default function InspectionsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState(null)
  const [vendors, setVendors] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const query = params.toString()
  const status = params.get('status') ?? ''

  useEffect(() => {
    api('/vendors').then((d) => setVendors(d.vendors), () => setVendors([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    api(`/inspections?${query}`).then(
      (d) => {
        if (cancelled) return
        setResult(d)
        setError('')
      },
      (err) => !cancelled && setError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [query])

  function update(changes) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  return (
    <>
      <PageHeader
        title="Inspections"
        description="Vehicle inspection checklists assigned to vendor inspectors, through client verification and Head of Operation approval."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New inspection
          </button>
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <section className="card" aria-label="Inspections">
        <div className="toolbar">
          <div className="field">
            <label className="field-label" htmlFor="insp-company">
              Vendor / company
            </label>
            <select id="insp-company" className="select" value={params.get('companyId') ?? ''} onChange={(e) => update({ companyId: e.target.value })}>
              <option value="">All companies</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <div className="chips" role="group" aria-label="Filter by status">
            {[['', 'All'], ...Object.entries(INSPECTION_STATUS).map(([k, v]) => [k, v.label])].map(([value, label]) => (
              <button key={value || 'all'} type="button" className="chip" aria-pressed={status === value} onClick={() => update({ status: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {!result && !error && <Loading />}
        {result?.inspections.length === 0 && (
          <EmptyState
            icon="layers"
            title={status || params.get('companyId') ? 'No inspections match' : 'No inspections yet'}
            actions={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" /> New inspection
              </button>
            }
          >
            Create an inspection to assign a vehicle checklist to an inspector.
          </EmptyState>
        )}
        {result?.inspections.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table-stack">
                <thead>
                  <tr>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Company</th>
                    <th scope="col">Inspector</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {result.inspections.map((i) => (
                    <tr key={i.id}>
                      <td data-label="">
                        <span className="cell-main">
                          <Link className="cell-title" to={`/inspections/${i.id}`}>
                            <VehicleTitle vehicle={i.vehicle} />
                          </Link>
                          <span className="cell-sub">
                            {i.templateName}
                            {i.currentRevision > 0 && ` · revision ${i.currentRevision}`}
                          </span>
                        </span>
                      </td>
                      <td data-label="Company">{i.companyName}</td>
                      <td data-label="Inspector">{i.inspector?.name ?? '—'}</td>
                      <td data-label="Status">
                        <InspectionStatusBadge status={i.status} />
                      </td>
                      <td data-label="Updated" className="num subtle" style={{ whiteSpace: 'nowrap' }}>
                        {formatDay(i.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <Pagination pagination={result.pagination} onPage={(page) => update({ page: String(page) })} noun="inspections" />
            </div>
          </>
        )}
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} wide title="New inspection" description="Assign a vehicle checklist to an inspector of the vendor company.">
        <CreateInspectionForm vendors={vendors} onCancel={() => setCreating(false)} onCreated={(inspection) => navigate(`/inspections/${inspection.id}`)} />
      </Modal>
    </>
  )
}

function CreateInspectionForm({ vendors, onCancel, onCreated }) {
  const [companyId, setCompanyId] = useState('')
  const [inspectors, setInspectors] = useState(null)
  const [templates, setTemplates] = useState(null)
  const [templateId, setTemplateId] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/checklist-templates').then(
      (d) => setTemplates(d.templates.filter((t) => t.active && t.current)),
      () => setTemplates([]),
    )
  }, [])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    api(`/vendors/${companyId}`).then(
      (d) => !cancelled && setInspectors(d.users.filter((u) => u.role === 'inspector' && u.active)),
      () => !cancelled && setInspectors([]),
    )
    return () => {
      cancelled = true
    }
  }, [companyId])

  const template = templates?.find((t) => String(t.id) === templateId)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      companyId: Number(form.get('companyId')),
      inspectorId: Number(form.get('inspectorId')),
      templateId: Number(form.get('templateId')),
      vehiclePlate: form.get('vehiclePlate'),
      vehicleRegistrationNo: form.get('vehicleRegistrationNo'),
      modRegistrationNo: form.get('modRegistrationNo'),
    }
    const next = {}
    if (!body.companyId) next.companyId = 'Choose the vendor / company.'
    if (!body.inspectorId) next.inspectorId = 'Choose an inspector.'
    if (!body.templateId) next.templateId = 'Choose a checklist template.'
    if (![body.vehiclePlate, body.vehicleRegistrationNo, body.modRegistrationNo].some((v) => String(v ?? '').trim())) {
      next.vehiclePlate = 'Enter at least one vehicle identifier.'
    }
    setErrors(next)
    setServerError('')
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const { inspection } = await api('/inspections', { method: 'POST', body })
      onCreated(inspection)
    } catch (err) {
      setServerError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="dialog-body">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        {templates?.length === 0 && (
          <Alert tone="warning">
            No active checklist template is published yet. <Link to="/templates">Publish one</Link> from the client’s checklist first.
          </Alert>
        )}
        <div className="form-section">
          <div className="form-section-head">
            <h3>Assignment</h3>
          </div>
          <div className="form-grid">
            <Field label="Vendor / company" error={errors.companyId}>
              <select
                className="select"
                name="companyId"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value)
                  setInspectors(null)
                }}
              >
                <option value="">Choose…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Inspector"
              error={errors.inspectorId}
              hint={companyId && inspectors?.length === 0 ? 'This company has no active Inspector account. Set an account’s role to Inspector first.' : undefined}
            >
              <select className="select" name="inspectorId" disabled={!companyId || !inspectors?.length} defaultValue="">
                <option value="">{companyId ? 'Choose…' : 'Choose a company first'}</option>
                {(inspectors ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.username}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-head">
            <h3>Vehicle</h3>
            <p>The vehicle type comes from the template. Enter every identifier the vehicle has.</p>
          </div>
          <div className="form-grid">
            <Field label="Checklist template" error={errors.templateId} hint={template ? `Vehicle type: ${template.vehicleType} · version ${template.current.version} · ${template.current.itemCount} items` : undefined}>
              <select className="select" name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Choose…</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.vehicleType} — {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle plate" optional error={errors.vehiclePlate}>
              <input className="input" name="vehiclePlate" maxLength={60} autoCapitalize="characters" />
            </Field>
            <Field label="Vehicle registration no." optional>
              <input className="input" name="vehicleRegistrationNo" maxLength={60} />
            </Field>
            <Field label="MOD registration no." optional>
              <input className="input" name="modRegistrationNo" maxLength={60} />
            </Field>
          </div>
        </div>
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create and assign'}
        </button>
      </div>
    </form>
  )
}
