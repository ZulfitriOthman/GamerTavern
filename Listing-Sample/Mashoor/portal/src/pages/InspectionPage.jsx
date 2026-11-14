import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { vehicleTitle, STAGE_LABELS } from '@mashoor/shared/inspection'
import { useAuth } from '@mashoor/shared/useAuth'
import { Icon } from '@mashoor/shared/Icon'
import { buildSummary, hasRemarks, progress, submitProblems } from '@mashoor/shared/checklist'
import { ChecklistForm } from '@mashoor/shared/ChecklistForm'
import { EventTimeline, InspectionStatusBadge, RevisionHistory, SignoffPanel, SummarySection } from '@mashoor/shared/InspectionView'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { diagramUrlFor } from '../inspectionUrls.js'

export default function InspectionPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const reload = () => setReloadKey((k) => k + 1)

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
          {loadError.status === 404 ? (
            <EmptyState icon="inbox" title="This inspection isn’t available" actions={<Link className="btn" to="/inspections">Back to inspections</Link>}>
              It may belong to another company or isn’t assigned to you.
            </EmptyState>
          ) : (
            <EmptyState tone="error" title="This inspection couldn’t load">
              {loadError.message}
            </EmptyState>
          )}
        </div>
      </>
    )
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Inspection" back={back} />
        <div className="card">
          <Loading label="Loading inspection…" />
        </div>
      </>
    )
  }

  const { inspection, viewer } = data
  const current = inspection.revisions.find((r) => r.current)
  const captionsFrom = (viewer.canEdit ? inspection.working?.definition : current?.snapshot.definition)?.signoff

  function after(result, message) {
    setData((d) => ({ ...d, inspection: result.inspection }))
    setNotice(message)
    setError('')
    reload()
  }

  return (
    <>
      <PageHeader
        back={back}
        title={vehicleTitle(inspection.vehicle)}
        badge={<InspectionStatusBadge status={inspection.status} />}
        description={`${inspection.templateName}${inspection.templateVersion ? ` (v${inspection.templateVersion})` : ''} · ${inspection.company.name}${
          inspection.currentRevision ? ` · revision ${inspection.currentRevision}` : ''
        }`}
        actions={
          (current || viewer.canEdit) && (
            <Link className="btn" to={`/inspections/${inspection.id}/print`}>
              <Icon name="eye" /> Print view
            </Link>
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
      {inspection.status === 'returned' && inspection.recheckReason && (
        <Alert tone="warning" title="Re-check requested by the client">
          <span className="prewrap">{inspection.recheckReason}</span>
          {viewer.canEdit && <div>Correct the checklist below and resubmit it for verification.</div>}
        </Alert>
      )}

      <div className="split form-split">
        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start', minWidth: 0 }}>
          {viewer.canEdit ? (
            <FormEditor key={inspection.updatedAt} inspection={inspection} onSaved={after} onError={setError} />
          ) : current ? (
            <>
              <Alert tone="info">
                Revision {current.revision} as submitted by {current.submittedBy?.name ?? 'the inspector'}. Nothing on it can be changed; a re-check creates a new
                revision.
              </Alert>
              <ChecklistForm
                readOnly
                definition={current.snapshot.definition}
                answers={current.snapshot.answers}
                vehicle={current.snapshot.vehicle}
                diagramUrl={diagramUrlFor(inspection.id, current.snapshot.definition)}
              />
              <SummarySection summary={current.summary} vehicle={current.snapshot.vehicle} />
            </>
          ) : (
            <section className="card">
              <EmptyState icon="inbox" title="Not submitted yet">
                It appears here once {inspection.inspector.name} submits it for verification.
              </EmptyState>
            </section>
          )}

          {viewer.canVerify && current && <ClientDecision inspection={inspection} revision={current} onDone={after} onError={setError} />}

          <SignoffPanel
            inspection={inspection}
            revision={current}
            captions={captionsFrom}
            renderAction={(stage) => {
              const mine = viewer.stages.find((s) => s.stage === stage)
              if (!mine || mine.signed) return null
              if (mine.blockedReason) return <span className="subtle">{mine.blockedReason}</span>
              return <SignAction stage={stage} inspection={inspection} revision={current} session={session} onDone={after} onError={setError} />
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start', minWidth: 0 }}>
          <section className="card" aria-labelledby="history-title">
            <div className="card-head">
              <div>
                <h2 id="history-title">History</h2>
                <p>
                  Assigned to {inspection.inspector.name} · {inspection.company.name}
                </p>
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

// The inspector's editable form: draft save (nothing required) and submit
// (every applicable field required — checked here first, then by the API).
function FormEditor({ inspection, onSaved, onError }) {
  const { definition } = inspection.working
  const [answers, setAnswers] = useState(inspection.working.answers)
  const [dirty, setDirty] = useState(false)
  const [problems, setProblems] = useState(new Map())
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const nextRevision = inspection.currentRevision + 1
  const done = progress(definition, answers)
  const summary = useMemo(() => buildSummary(inspection.vehicle, definition, answers), [inspection.vehicle, definition, answers])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function change(next) {
    setAnswers(next)
    setDirty(true)
    if (problems.size) {
      // Re-check only the fields already flagged, so errors clear as they're fixed.
      const still = new Map(submitProblems(definition, next).filter((p) => problems.has(p.field)).map((p) => [p.field, p.message]))
      setProblems(still)
    }
  }

  async function save() {
    setBusy(true)
    try {
      const result = await api(`/inspections/${inspection.id}/form`, { method: 'PUT', body: { answers } })
      setDirty(false)
      onSaved(result, 'Draft saved. You can come back to it later.')
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function showProblems(list) {
    setProblems(new Map(list.map((p) => [p.field, p.message])))
    onError(`Complete the checklist before submitting — ${list.length} missing. The first: ${list[0].message}`)
    const first = list[0].field
    const target = first.startsWith('item.')
      ? document.getElementById(`item-${first.split('.')[1]}`)
      : document.getElementById(`field-${first.replace('.', '-')}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function startSubmit() {
    const list = submitProblems(definition, answers)
    if (list.length) return showProblems(list)
    setProblems(new Map())
    setConfirming(true)
  }

  async function submit() {
    setBusy(true)
    try {
      const result = await api(`/inspections/${inspection.id}/submit`, { method: 'POST', body: { answers } })
      setConfirming(false)
      setDirty(false)
      onSaved(result, `Revision ${nextRevision} submitted for client verification.`)
    } catch (err) {
      setConfirming(false)
      if (err.data?.problems?.length) showProblems(err.data.problems)
      else onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ChecklistForm
        definition={definition}
        answers={answers}
        onChange={change}
        problems={problems}
        vehicle={inspection.vehicle}
        diagramUrl={diagramUrlFor(inspection.id, definition)}
      />

      <SummarySection summary={summary} vehicle={inspection.vehicle} title="Summary (as entered)" />

      <div className="sticky-actions">
        <span className="grow">
          <span className="num">
            {done.done} / {done.total}
          </span>{' '}
          items answered · {dirty ? 'unsaved changes' : 'all changes saved'}
        </span>
        <button type="button" className="btn" onClick={save} disabled={busy || !dirty}>
          Save draft
        </button>
        <button type="button" className="btn btn-primary" onClick={startSubmit} disabled={busy}>
          {inspection.currentRevision ? 'Resubmit for verification' : 'Submit for verification'}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`Submit revision ${nextRevision}?`}
        description={`The checklist is locked while the client reviews it. ${
          hasRemarks(answers) ? 'It has remarks, so acknowledgement will be pending.' : 'It has no remarks, so it will be auto-acknowledged (this is not an approval).'
        }`}
        confirmLabel="Submit for verification"
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

function ClientDecision({ inspection, revision, onDone, onError }) {
  const [dialog, setDialog] = useState(null) // 'recheck' | 'forward'
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [busy, setBusy] = useState(false)
  const revisionNumber = revision?.revision

  async function send(path, body, message) {
    setBusy(true)
    try {
      const result = await api(`/inspections/${inspection.id}/${path}`, { method: 'POST', body: { revision: revisionNumber, ...body } })
      setDialog(null)
      onDone(result, message)
    } catch (err) {
      setDialog(null)
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function submitRecheck(event) {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setReasonError('Explain what is missing or incorrect.')
      return
    }
    send('recheck', { reason }, 'Returned to the inspector for re-check.')
  }

  return (
    <section className="card" aria-labelledby="verify-title">
      <div className="card-head">
        <div>
          <h2 id="verify-title">Client verification</h2>
          <p>Review revision {revisionNumber}. Ask the inspector to re-check it, or send it on for Head of Operation approval.</p>
        </div>
      </div>
      <div className="card-body row-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={() => {
            setReason('')
            setReasonError('')
            setDialog('recheck')
          }}
        >
          <Icon name="back" /> Request Re-check
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setDialog('forward')}>
          Submit to HOO Approval <Icon name="next" />
        </button>
      </div>

      <Modal
        open={dialog === 'recheck'}
        onClose={() => setDialog(null)}
        title="Request Re-check"
        description="The inspector is asked to inspect again and correct the checklist. Say which items are missing or incorrect."
      >
        <form onSubmit={submitRecheck} noValidate>
          <div className="dialog-body">
            <Field label="What needs to be re-checked?" error={reasonError}>
              <textarea className="textarea" rows={5} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="dialog-foot">
            <button type="button" className="btn" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Request Re-check'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={dialog === 'forward'}
        tone="primary"
        title="Submit to HOO Approval?"
        description={`You confirm revision ${revisionNumber} as verified. It goes to the Head of Operation for approval and can no longer be returned from here.`}
        confirmLabel="Submit to HOO Approval"
        busy={busy}
        onConfirm={() => send('verify', {}, `Revision ${revisionNumber} submitted to HOO approval.`)}
        onCancel={() => setDialog(null)}
      />
    </section>
  )
}

// Confirmation of the signed-in account's own stage: re-enter the full name on
// the account (checked by the API). This confirms intent; the session is the
// authentication.
function SignAction({ stage, inspection, revision, session, onDone, onError }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)
  const label = STAGE_LABELS[stage]

  async function submit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Type your full name.')
      return
    }
    setBusy(true)
    try {
      const result = await api(`/inspections/${inspection.id}/signoffs/${stage}`, {
        method: 'POST',
        body: { revision: revision?.revision, fullName: name },
      })
      setOpen(false)
      onDone(result, `${label} confirmed for revision ${revision?.revision}.`)
    } catch (err) {
      if (err.status === 400) setNameError(err.message)
      else {
        setOpen(false)
        onError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => {
          setName('')
          setNameError('')
          setOpen(true)
        }}
      >
        Confirm
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Confirm: ${label}`}
        description={`You are confirming revision ${revision?.revision} of ${vehicleTitle(inspection.vehicle)} as ${session.user.name}. Type your full name exactly as recorded on your account.`}
      >
        <form onSubmit={submit} noValidate>
          <div className="dialog-body">
            <Field label="Your full name" error={nameError} hint="Spacing and capital letters don’t matter.">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
          </div>
          <div className="dialog-foot">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Confirming…' : `Confirm ${label}`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
