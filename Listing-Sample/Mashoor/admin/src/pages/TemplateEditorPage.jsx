import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { formatDate } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { VEHICLE_TYPES } from '@mashoor/shared/inspection'
import { DETAIL_FIELDS, emptyAnswers, newKey } from '@mashoor/shared/checklist'
import { ChecklistForm } from '@mashoor/shared/ChecklistForm'
import { ChecklistPrint } from '@mashoor/shared/ChecklistPrint'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { diagramUrl } from '../diagramUrl.js'

const STAGES = [
  ['checked_by', 'Checked by'],
  ['agreed_by', 'Agreed by'],
  ['approved_by', 'Approved by'],
]

export default function TemplateEditorPage() {
  const { id } = useParams()
  return id ? <ExistingTemplate id={id} /> : <NewTemplate />
}

// ---- New template -----------------------------------------------------------

function NewTemplate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const { template } = await api('/checklist-templates', { method: 'POST', body: { name: form.get('name'), vehicleType: form.get('vehicleType') } })
      navigate(`/templates/${template.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="New checklist template" back={{ to: '/templates', label: 'Checklist templates' }} description="Starts as an empty draft. Enter the client’s checklist content, preview it, then publish." />
      {error && <Alert tone="danger">{error}</Alert>}
      <form className="card card-body form-stack" onSubmit={handleSubmit} style={{ maxWidth: '40rem' }}>
        <Field label="Template name">
          <input className="input" name="name" required maxLength={200} />
        </Field>
        <Field label="Vehicle type">
          <select className="select" name="vehicleType" defaultValue={params.get('type') ?? ''} required>
            <option value="" disabled>
              Choose…
            </option>
            {VEHICLE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="form-actions start">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </>
  )
}

// ---- Existing template --------------------------------------------------------

function ExistingTemplate({ id }) {
  const [data, setData] = useState(null)
  const [diagrams, setDiagrams] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [def, setDef] = useState(null) // the definition being edited (draft), or null
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('edit')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'publish' | 'discard'

  const [reloadKey, setReloadKey] = useState(0)
  const load = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([api(`/checklist-templates/${id}`), api('/checklist-diagrams')]).then(
      ([t, d]) => {
        if (cancelled) return
        setData(t)
        setDiagrams(d.diagrams)
        setDef(t.draft ? structuredClone(t.draft.definition) : null)
        setDirty(false)
        setLoadError(null)
      },
      (err) => !cancelled && setLoadError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const back = { to: '/templates', label: 'Checklist templates' }
  if (loadError) {
    return (
      <>
        <PageHeader title="Checklist template" back={back} />
        <div className="card">
          <EmptyState tone="error" title="This template couldn’t load">
            {loadError.message}
          </EmptyState>
        </div>
      </>
    )
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Checklist template" back={back} />
        <div className="card">
          <Loading />
        </div>
      </>
    )
  }

  const { template, current, draft, versions } = data
  const editing = def !== null
  const shown = def ?? current?.definition
  const nextVersion = draft?.version ?? Math.max(0, ...versions.map((v) => v.version)) + 1

  function change(fn) {
    setDef((d) => {
      const copy = structuredClone(d)
      fn(copy)
      return copy
    })
    setDirty(true)
  }

  async function saveDraft({ quiet } = {}) {
    setBusy(true)
    setError('')
    try {
      await api(`/checklist-templates/${id}/draft`, { method: 'PUT', body: { definition: def } })
      if (!quiet) setNotice(`Draft v${nextVersion} saved.`)
      load()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    setConfirm(null)
    if (dirty && !(await saveDraft({ quiet: true }))) return
    setBusy(true)
    try {
      await api(`/checklist-templates/${id}/publish`, { method: 'POST' })
      setNotice(`Version ${nextVersion} published. New inspections use it; existing inspections keep their version.`)
      load()
    } catch (err) {
      setError(err.data?.problems?.length ? err.data.problems.join(' ') : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function discard() {
    setConfirm(null)
    if (!draft) {
      setDef(null)
      setDirty(false)
      return
    }
    setBusy(true)
    try {
      await api(`/checklist-templates/${id}/draft`, { method: 'DELETE' })
      setNotice('Draft discarded.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        back={back}
        title={template.name}
        badge={
          <span className="badge plain">
            {template.vehicleType}
            {current ? ` · v${current.version} published` : ' · not published'}
          </span>
        }
        description={shown?.source ? `Source: ${shown.source}` : 'Checklist form used for this vehicle type.'}
        actions={
          editing ? (
            <>
              <button type="button" className="btn" onClick={() => setConfirm('discard')} disabled={busy || (!!draft && !current)}>
                Discard draft
              </button>
              <button type="button" className="btn" onClick={() => saveDraft()} disabled={busy || !dirty}>
                Save draft
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setConfirm('publish')} disabled={busy}>
                Publish v{nextVersion}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setDef(structuredClone(current.definition))
                setDirty(true)
                setTab('edit')
              }}
            >
              <Icon name="edit" /> Edit as new version (v{nextVersion})
            </button>
          )
        }
      />
      {error && (
        <Alert tone="danger" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {editing ? (
        <Alert tone="info">
          Editing draft v{nextVersion}
          {dirty ? ' — unsaved changes' : ''}. Published versions never change: inspections already created keep the version they started with.
        </Alert>
      ) : (
        <Alert tone="info">Version {current.version} is published and frozen. To change the form, edit it as a new version and publish that.</Alert>
      )}

      <TemplateSettings
        template={template}
        onSaved={(message) => {
          setNotice(message)
          load()
        }}
        onError={setError}
      />

      <nav className="tabs" aria-label="Template views">
        {[
          ['edit', editing ? 'Edit form' : 'Form structure'],
          ['preview', 'Preview'],
          ['versions', `Versions (${versions.length})`],
        ].map(([key, label]) => (
          <button key={key} type="button" className={`tab btn-link${tab === key ? ' active' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'edit' &&
        (editing ? (
          <DefinitionEditor def={def} change={change} diagrams={diagrams} vehicleType={template.vehicleType} onDiagramUploaded={(d) => setDiagrams((list) => [...list, d])} onError={setError} />
        ) : (
          <PreviewPane definition={current.definition} vehicleType={template.vehicleType} readOnlyNote />
        ))}
      {tab === 'preview' && shown && <PreviewPane definition={shown} vehicleType={template.vehicleType} />}
      {tab === 'versions' && <VersionsPane templateId={template.id} versions={versions} vehicleType={template.vehicleType} />}

      <ConfirmDialog
        open={confirm === 'publish'}
        tone="primary"
        title={`Publish version ${nextVersion}?`}
        description="It becomes the form for new inspections of this template and can no longer be edited. Existing inspections are not changed."
        confirmLabel={`Publish v${nextVersion}`}
        busy={busy}
        onConfirm={publish}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard this draft?"
        description="Unpublished changes are lost. The published version stays as it is."
        confirmLabel="Discard draft"
        busy={busy}
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

function TemplateSettings({ template, onSaved, onError }) {
  const [saving, setSaving] = useState(false)
  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await api(`/checklist-templates/${template.id}`, {
        method: 'PATCH',
        body: { name: form.get('name'), vehicleType: form.get('vehicleType'), active: form.get('active') === 'on' },
      })
      onSaved('Template settings saved.')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <details className="card">
      <summary className="card-head" style={{ cursor: 'pointer' }}>
        <div>
          <h2>Template settings</h2>
          <p>Name, vehicle type and whether it can be used for new inspections.</p>
        </div>
      </summary>
      <form className="card-body form-stack" onSubmit={handleSubmit} key={template.updatedAt}>
        <div className="form-grid">
          <Field label="Template name">
            <input className="input" name="name" defaultValue={template.name} maxLength={200} required />
          </Field>
          <Field label="Vehicle type">
            <select className="select" name="vehicleType" defaultValue={template.vehicleType}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={template.active} /> Active — can be chosen for new inspections
        </label>
        <div className="form-actions start">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </details>
  )
}

// ---- Structure editor -----------------------------------------------------------

function move(list, index, delta) {
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [x] = list.splice(index, 1)
  list.splice(target, 0, x)
}

function ToolButtons({ onUp, onDown, onRemove, label }) {
  return (
    <span className="te-tools">
      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onUp} aria-label={`Move ${label} up`} title="Move up">
        <Icon name="back" className="rot90" />
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onDown} aria-label={`Move ${label} down`} title="Move down">
        <Icon name="next" className="rot90" />
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onRemove} aria-label={`Remove ${label}`} title="Remove">
        <Icon name="trash" />
      </button>
    </span>
  )
}

const newItem = (child = false) => ({ key: newKey('i'), number: '', label: child ? 'New nested item' : 'New item', status: true, measurements: [], ...(child ? {} : { children: [] }) })

function ItemEditor({ item, path, change, isChild, index, count }) {
  // path: [sectionIndex, itemIndex] or [sectionIndex, itemIndex, childIndex]
  const at = (d) => (isChild ? d.sections[path[0]].items[path[1]].children[path[2]] : d.sections[path[0]].items[path[1]])
  const siblings = (d) => (isChild ? d.sections[path[0]].items[path[1]].children : d.sections[path[0]].items)
  const label = item.label || 'item'
  return (
    <li className={`te-item${isChild ? ' child' : ''}`}>
      <div className="te-row">
        <input
          className="input"
          aria-label={`Number of ${label}`}
          placeholder={isChild ? '–' : 'No.'}
          value={item.number}
          maxLength={12}
          onChange={(e) => change((d) => (at(d).number = e.target.value))}
        />
        <input className="input" aria-label="Item label" value={item.label} maxLength={200} onChange={(e) => change((d) => (at(d).label = e.target.value))} />
        <label className="check" title="Inspector chooses a status mark for this row">
          <input type="checkbox" checked={item.status} onChange={(e) => change((d) => (at(d).status = e.target.checked))} /> Status
        </label>
        <ToolButtons
          label={label}
          onUp={() => change((d) => move(siblings(d), path[path.length - 1], -1))}
          onDown={() => change((d) => move(siblings(d), path[path.length - 1], 1))}
          onRemove={() => change((d) => siblings(d).splice(path[path.length - 1], 1))}
        />
      </div>
      {item.measurements.map((m, mi) => (
        <div className="te-measure" key={m.key}>
          <input
            className="input"
            aria-label="Measurement label"
            placeholder="Label (blank = item label)"
            value={m.label}
            maxLength={80}
            onChange={(e) => change((d) => (at(d).measurements[mi].label = e.target.value))}
          />
          <input className="input" aria-label="Unit" placeholder="Unit" value={m.unit} maxLength={16} onChange={(e) => change((d) => (at(d).measurements[mi].unit = e.target.value))} />
          <select className="select" aria-label="Positions" value={m.layout} onChange={(e) => change((d) => (at(d).measurements[mi].layout = e.target.value))}>
            <option value="axle">Front/Rear · R/L</option>
            <option value="single">Single value</option>
          </select>
          <label className="check">
            <input type="checkbox" checked={m.required} onChange={(e) => change((d) => (at(d).measurements[mi].required = e.target.checked))} /> Required
          </label>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Remove measurement" onClick={() => change((d) => at(d).measurements.splice(mi, 1))}>
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <div className="te-sub">
        {item.measurements.length < 4 && (
          <button
            type="button"
            className="btn-link"
            onClick={() => change((d) => at(d).measurements.push({ key: newKey('m'), label: '', unit: '', layout: 'single', required: false }))}
          >
            <Icon name="plus" /> Measurement
          </button>
        )}
        {!isChild && (
          <button type="button" className="btn-link" onClick={() => change((d) => at(d).children.push(newItem(true)))}>
            <Icon name="plus" /> Nested item
          </button>
        )}
        <span className="subtle">
          {index + 1} of {count}
        </span>
      </div>
      {!isChild && item.children?.length > 0 && (
        <ol className="te-items">
          {item.children.map((child, ci) => (
            <ItemEditor key={child.key} item={child} path={[...path, ci]} change={change} isChild index={ci} count={item.children.length} />
          ))}
        </ol>
      )}
    </li>
  )
}

function DefinitionEditor({ def, change, diagrams, vehicleType, onDiagramUploaded, onError }) {
  const [uploading, setUploading] = useState(false)
  const diagram = diagrams.find((d) => d.id === def.damage.diagramId)

  async function upload(event) {
    event.preventDefault()
    const formEl = event.currentTarget
    const form = new FormData(formEl)
    const file = form.get('image')
    if (!file?.size) return onError('Choose an image file.')
    const body = new FormData()
    body.append('image', file)
    setUploading(true)
    try {
      const { diagram: created } = await api(
        `/checklist-diagrams?name=${encodeURIComponent(form.get('name') || file.name)}&vehicleType=${encodeURIComponent(vehicleType)}`,
        { method: 'POST', body },
      )
      onDiagramUploaded(created)
      change((d) => (d.damage.diagramId = created.id))
      formEl.reset()
    } catch (err) {
      onError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Document header</h2>
            <p>Printed at the top of the form and its A4 print.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          <div className="form-grid">
            <Field label="Company name">
              <input className="input" value={def.header.companyName} maxLength={120} onChange={(e) => change((d) => (d.header.companyName = e.target.value))} />
            </Field>
            <Field label="Title">
              <input className="input" value={def.header.title} maxLength={120} onChange={(e) => change((d) => (d.header.title = e.target.value))} />
            </Field>
            <Field label="Project heading" className="span-all">
              <input className="input" value={def.header.subtitle} maxLength={300} onChange={(e) => change((d) => (d.header.subtitle = e.target.value))} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={def.header.showLogos} onChange={(e) => change((d) => (d.header.showLogos = e.target.checked))} /> Show the HMM and Mashhor logos
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Vehicle details</h2>
            <p>MOD Reg. No., vehicle plate, registration no. and type come from the inspection. Defaults below are pre-filled and can be changed by the inspector.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          {Object.entries(DETAIL_FIELDS).map(([key, label]) => {
            const index = def.details.findIndex((d) => d.key === key)
            const entry = def.details[index]
            return (
              <div key={key} className="te-legend" style={{ gridTemplateColumns: '9rem minmax(0, 1fr) auto auto' }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!entry}
                    onChange={(e) =>
                      change((d) => {
                        if (e.target.checked) d.details.push({ key, default: '', required: false })
                        else d.details.splice(index, 1)
                      })
                    }
                  />
                  {label}
                </label>
                <input
                  className="input"
                  aria-label={`${label} default`}
                  placeholder={entry ? 'Default (optional)' : 'Not on this form'}
                  disabled={!entry || key === 'date'}
                  value={entry?.default ?? ''}
                  maxLength={200}
                  onChange={(e) => change((d) => (d.details[index].default = e.target.value))}
                />
                <label className="check">
                  <input type="checkbox" disabled={!entry} checked={!!entry?.required} onChange={(e) => change((d) => (d.details[index].required = e.target.checked))} /> Required
                </label>
                <span />
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Status legend</h2>
            <p>The marks an inspector can choose for each item. Nothing is selected by default.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          {def.statusLegend.map((s, i) => (
            <div key={i} className="te-legend">
              <input className="input" aria-label="Mark" value={s.value} maxLength={12} onChange={(e) => change((d) => (d.statusLegend[i].value = e.target.value))} />
              <input className="input" aria-label="Meaning" value={s.label} maxLength={60} onChange={(e) => change((d) => (d.statusLegend[i].label = e.target.value))} />
              <ToolButtons
                label={`mark ${s.value}`}
                onUp={() => change((d) => move(d.statusLegend, i, -1))}
                onDown={() => change((d) => move(d.statusLegend, i, 1))}
                onRemove={() => change((d) => d.statusLegend.splice(i, 1))}
              />
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-sm" onClick={() => change((d) => d.statusLegend.push({ value: '', label: '' }))}>
              <Icon name="plus" /> Add mark
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Checklist sections</h2>
            <p>Numbers and labels are shown exactly as entered. “Column” places the section in the left or right half of the A4 print.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          {def.sections.map((section, si) => (
            <div key={section.key} className="te-section">
              <div className="te-section-head">
                <Field label="No.">
                  <input className="input" value={section.number} maxLength={12} onChange={(e) => change((d) => (d.sections[si].number = e.target.value))} />
                </Field>
                <Field label="Section title">
                  <input className="input" value={section.title} maxLength={160} onChange={(e) => change((d) => (d.sections[si].title = e.target.value))} />
                </Field>
                <Field label="Print column">
                  <select className="select" value={section.column} onChange={(e) => change((d) => (d.sections[si].column = Number(e.target.value)))}>
                    <option value={1}>Left</option>
                    <option value={2}>Right</option>
                  </select>
                </Field>
                <ToolButtons
                  label={`section ${section.number || si + 1}`}
                  onUp={() => change((d) => move(d.sections, si, -1))}
                  onDown={() => change((d) => move(d.sections, si, 1))}
                  onRemove={() => change((d) => d.sections.splice(si, 1))}
                />
              </div>
              <ol className="te-items">
                {section.items.map((item, ii) => (
                  <ItemEditor key={item.key} item={item} path={[si, ii]} change={change} index={ii} count={section.items.length} />
                ))}
              </ol>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <button type="button" className="btn btn-sm" onClick={() => change((d) => d.sections[si].items.push(newItem()))}>
                  <Icon name="plus" /> Add item
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => change((d) => d.sections.push({ key: newKey('s'), number: `${d.sections.length + 1}.`, title: 'New section', column: 1, items: [] }))}
            >
              <Icon name="plus" /> Add section
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Remarks, servicing and sign-off</h2>
            <p>Sign-off captions are printed under each line. They are labels only: who may confirm is set per vendor under Inspection sign-offs.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          <label className="check">
            <input type="checkbox" checked={def.footer.remarks} onChange={(e) => change((d) => (d.footer.remarks = e.target.checked))} /> Remarks / Comments
          </label>
          <label className="check">
            <input type="checkbox" checked={def.footer.nextServicing} onChange={(e) => change((d) => (d.footer.nextServicing = e.target.checked))} /> Next Servicing
          </label>
          <div className="form-grid">
            {STAGES.map(([stage, title]) => (
              <Field key={stage} label={`${title} — caption`}>
                <input className="input" value={def.signoff[stage].caption} maxLength={120} onChange={(e) => change((d) => (d.signoff[stage].caption = e.target.value))} />
              </Field>
            ))}
            <Field label="Approved by — printed name" hint="Printed on the form only; it does not grant approval.">
              <input className="input" value={def.signoff.approved_by.printedName} maxLength={120} onChange={(e) => change((d) => (d.signoff.approved_by.printedName = e.target.value))} />
            </Field>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Damage assessment page</h2>
            <p>Diagram the inspector marks damage on, with Extent of damage (None, Minor, Extensive, Beyond Repair) and notes.</p>
          </div>
        </div>
        <div className="card-body form-stack">
          <label className="check">
            <input type="checkbox" checked={def.damage.enabled} onChange={(e) => change((d) => (d.damage.enabled = e.target.checked))} /> Include the damage diagram page
          </label>
          {def.damage.enabled && (
            <>
              <Field label="Note above the diagram">
                <input className="input" value={def.damage.note} maxLength={300} onChange={(e) => change((d) => (d.damage.note = e.target.value))} />
              </Field>
              <Field label="Diagram" hint={diagram?.source ? `Source: ${diagram.source}` : undefined}>
                <select
                  className="select"
                  value={def.damage.diagramId ?? ''}
                  onChange={(e) => change((d) => (d.damage.diagramId = e.target.value ? Number(e.target.value) : null))}
                >
                  <option value="">Choose a diagram…</option>
                  {diagrams.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.vehicleType ? ` (${d.vehicleType})` : ''}
                      {d.builtIn ? ' — from client PDF' : ' — uploaded'}
                    </option>
                  ))}
                </select>
              </Field>
              {diagram && <img src={diagramUrl(diagram.id)} alt={`${diagram.name} diagram`} style={{ maxWidth: '28rem', border: '1px solid var(--border)', borderRadius: 8 }} />}
              <form className="form-grid" onSubmit={upload} style={{ alignItems: 'end' }}>
                <Field label="Upload a different diagram" optional hint="PNG, JPEG or WebP, up to 5 MB. Use the client’s own drawing for this vehicle.">
                  <input className="file-input" type="file" name="image" accept="image/png,image/jpeg,image/webp" />
                </Field>
                <Field label="Diagram name" optional>
                  <input className="input" name="name" maxLength={120} />
                </Field>
                <div>
                  <button type="submit" className="btn btn-sm" disabled={uploading}>
                    <Icon name="upload" /> {uploading ? 'Uploading…' : 'Upload and use'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

// ---- Preview ---------------------------------------------------------------------

function PreviewPane({ definition, vehicleType, readOnlyNote }) {
  const [mode, setMode] = useState('form')
  const [answers, setAnswers] = useState(() => {
    const a = emptyAnswers()
    for (const d of definition.details) if (d.default) a.details[d.key] = d.default
    return a
  })
  const vehicle = { type: vehicleType, plate: 'PREVIEW', registrationNo: '', modRegistrationNo: 'MOD ____' }
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="chips" role="group" aria-label="Preview mode">
        <button type="button" className="chip" aria-pressed={mode === 'form'} onClick={() => setMode('form')}>
          Inspector form
        </button>
        <button type="button" className="chip" aria-pressed={mode === 'print'} onClick={() => setMode('print')}>
          A4 print
        </button>
      </div>
      <Alert tone="info">
        {readOnlyNote ? 'The published form, as inspectors see it. ' : ''}Preview only — answers typed here are not saved anywhere.
      </Alert>
      {mode === 'form' ? (
        <ChecklistForm definition={definition} answers={answers} onChange={setAnswers} vehicle={vehicle} diagramUrl={diagramUrl(definition.damage?.diagramId)} />
      ) : (
        <ChecklistPrint
          definition={definition}
          answers={answers}
          vehicle={vehicle}
          revision={null}
          signatories={[]}
          diagramUrl={definition.damage?.enabled ? diagramUrl(definition.damage.diagramId) : null}
          meta={{ inspectionId: '—', companyName: 'Preview', templateName: 'Template preview' }}
        />
      )}
    </div>
  )
}

function VersionsPane({ templateId, versions, vehicleType }) {
  const [viewing, setViewing] = useState(null)
  const [error, setError] = useState('')
  async function open(v) {
    try {
      setViewing((await api(`/checklist-templates/${templateId}/versions/${v.id}`)).version)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <section className="card">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">State</th>
              <th scope="col">Items</th>
              <th scope="col">Published</th>
              <th scope="col">
                <span className="visually-hidden">View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td data-label="" className="num">
                  <strong>v{v.version}</strong>
                  {v.imported && <span className="subtle"> · imported from PDF</span>}
                </td>
                <td data-label="State">{v.state === 'draft' ? <span className="badge accent">Draft</span> : <span className="badge success">Published</span>}</td>
                <td data-label="Items" className="num">
                  {v.itemCount}
                </td>
                <td data-label="Published" className="subtle">
                  {v.publishedAt ? formatDate(v.publishedAt) : '—'}
                </td>
                <td data-label="" className="col-actions">
                  <button type="button" className="btn btn-sm" onClick={() => open(v)}>
                    <Icon name="eye" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!viewing} onClose={() => setViewing(null)} wide title={viewing ? `Version ${viewing.version} (${viewing.state})` : ''}>
        {viewing && (
          <div className="dialog-body">
            <ChecklistForm readOnly definition={viewing.definition} answers={emptyAnswers()} vehicle={{ type: vehicleType }} diagramUrl={diagramUrl(viewing.definition.damage?.diagramId)} />
          </div>
        )}
      </Modal>
      <div className="card-foot">
        <Link to="/inspections" className="subtle">
          Inspections record the version they were created from.
        </Link>
      </div>
    </section>
  )
}
