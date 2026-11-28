// Portal inspection page: the inspector's checklist (draft / submit), client
// verification (re-check or forward), and name-confirmed sign-offs.
// Derived from the existing portal InspectionPage; the prototype adds a reload
// prompt when the API refuses an action because the inspection changed in the
// meantime (409 — e.g. STALE_REVISION after a resubmission). All rules are
// enforced by the API (Backend/mashoor/src/routes/portal.js).
// It also follows live updates (Socket.IO /mashoor): a change made elsewhere
// reloads the page, except while the inspector has unsaved edits — then the
// update is announced with a Reload button instead of discarding their work.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { vehicleTitle, STAGE_LABELS } from '@mashoor/shared/inspection'
import { useAuth } from '@mashoor/shared/useAuth'
import { Icon } from '@mashoor/shared/Icon'
import { formatDay } from '@mashoor/shared/format'
import { buildSummary, hasRemarks, progress, statusTone, submitProblems } from '@mashoor/shared/checklist'
import { ChecklistForm } from '@mashoor/shared/ChecklistForm'
import { EventTimeline, InspectionStatusBadge, RevisionHistory, SignoffPanel, SummarySection } from '@mashoor/shared/InspectionView'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { useLiveVersion } from '@prototype/useLive.js'
import { JourneyStrip } from '@prototype/JourneyStrip.jsx'
import { api, diagramUrl } from '../api.js'

export default function InspectionPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null) // { message, stale }
  const reload = () => setReloadKey((k) => k + 1)

  // Live updates for this inspection. Own actions already reload after the
  // API answers; someone else's change reloads now, or is held while the
  // inspector has unsaved edits.
  const live = useLiveVersion(id)
  const [liveSeen, setLiveSeen] = useState(0)
  const [editing, setEditing] = useState(false)
  const [liveNote, setLiveNote] = useState(null) // { text, held }
  if (live.version !== liveSeen) {
    setLiveSeen(live.version)
    const event = live.last
    if (!event?.self) {
      const text = liveText(event)
      if (editing) setLiveNote({ text, held: true })
      else {
        setLiveNote(text ? { text, held: false } : null)
        setReloadKey((k) => k + 1)
      }
    }
  }
  // Children report a message string or an ApiError. A 409 means the
  // inspection moved on (another revision, decision or sign-off): offer a reload.
  const report = (e) => {
    const stale = typeof e !== 'string' && e.status === 409
    setError({ message: typeof e === 'string' ? e : e.message, stale })
    // The decision/sign-off buttons sit low on the page; bring the reload prompt into view.
    if (stale) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const back = { to: '/inspections', label: 'Back to inspections' }
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
  const myTurn = Boolean(current) && viewer.stages.some((s) => !s.signed && !s.blockedReason)
  // The status badge sits on the Summary fold when there is one, otherwise beside the title.
  const showSummary = !viewer.canEdit && Boolean(current)
  const statusBadge = <InspectionStatusBadge status={inspection.status} />

  function after(result, message) {
    setData((d) => ({ ...d, inspection: result.inspection }))
    setNotice(message)
    setError(null)
    reload()
  }

  // After submitting, the inspector's task is done: back to the list, with where it went and what happens next.
  function submitted(result) {
    const sent = result.inspection
    navigate('/inspections?queue=submitted', {
      state: {
        notice: {
          title: `${vehicleTitle(sent.vehicle)} sent to ${sent.company.name} for review`,
          body: 'You’ll find it under Submitted. If they ask for a re-check, it comes back under Re-check requested.',
        },
      },
    })
  }

  const approver = current?.signoffs.find((s) => s.stage === 'approved_by')?.name

  return (
    <>
      <PageHeader
        back={back}
        title={vehicleTitle(inspection.vehicle)}
        badge={showSummary ? undefined : statusBadge}
        description={`${inspection.templateName} · ${inspection.company.name}${
          inspection.currentRevision > 1 ? ` · revision ${inspection.currentRevision}` : ''
        }`}
        actions={
          (current || viewer.canEdit) && (
            <Link className="btn" to={`/inspections/${inspection.id}/print`}>
              <Icon name="eye" /> Print view
            </Link>
          )
        }
      />
      <JourneyStrip inspection={inspection} viewer={viewer} />
      {inspection.status === 'approved' && (
        <section className="proto-approved" aria-label="Approved">
          <span className="proto-approved-mark" aria-hidden="true">
            <Icon name="check" />
          </span>
          <span className="proto-approved-text">
            <strong>Approved by the Head of Operation</strong>
            <span>
              {[approver, formatDay(inspection.approvedAt, '')].filter(Boolean).join(' · ')}. This checklist is final.
            </span>
          </span>
          <Link className="btn" to={`/inspections/${inspection.id}/print`}>
            Print final checklist
          </Link>
        </section>
      )}
      {error && (
        <Alert tone="danger" title={error.stale ? 'This inspection has changed' : undefined} onDismiss={() => setError(null)}>
          {error.message}
          {error.stale && (
            <div className="proto-alert-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setError(null)
                  setNotice('')
                  reload()
                }}
              >
                Reload inspection
              </button>
              <span className="subtle">Nothing was recorded. Review the current revision, then act again.</span>
            </div>
          )}
        </Alert>
      )}
      {liveNote?.held && (
        <Alert tone="warning" title="This inspection was updated elsewhere" onDismiss={() => setLiveNote(null)}>
          {liveNote.text ?? 'Its details changed while you were editing.'}
          <div className="proto-alert-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setLiveNote(null)
                setError(null)
                reload()
              }}
            >
              Reload inspection
            </button>
            <span className="subtle">Reloading discards your unsaved changes.</span>
          </div>
        </Alert>
      )}
      {liveNote && !liveNote.held && (
        <Alert tone="info" onDismiss={() => setLiveNote(null)}>
          Updated just now: {liveNote.text}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {inspection.status === 'returned' && inspection.recheckReason && (
        // The client sees their own request; the inspector sees who sent it back.
        <Alert tone="warning" title={session.user.role === 'client' ? 'Re-check requested' : `Re-check requested by ${inspection.company.name}`}>
          <span className="prewrap">{inspection.recheckReason}</span>
          {viewer.canEdit && <div>Correct the checklist below and resubmit it for verification.</div>}
          {session.user.role === 'client' && <div>Sent back to {inspection.inspector.name}. Waiting for the corrected checklist.</div>}
        </Alert>
      )}

      <div className="split form-split">
        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start', minWidth: 0 }}>
          {viewer.canEdit ? (
            <FormEditor
              key={inspection.updatedAt}
              inspection={inspection}
              onSaved={after}
              onSubmitted={submitted}
              onError={report}
              onDirtyChange={setEditing}
            />
          ) : current ? (
            <>
              <IssueFilter key={current.revision} definition={current.snapshot.definition} answers={current.snapshot.answers}>
                <ChecklistForm
                  readOnly
                  definition={current.snapshot.definition}
                  answers={current.snapshot.answers}
                  vehicle={current.snapshot.vehicle}
                  diagramUrl={diagramUrl(inspection.id, current.snapshot.definition)}
                />
              </IssueFilter>
            </>
          ) : (
            <section className="card">
              <EmptyState icon="inbox" title="Not submitted yet">
                It appears here once {inspection.inspector.name} submits it for verification.
              </EmptyState>
            </section>
          )}

        </div>

        <div className="proto-side" style={{ display: 'grid', gap: '1.5rem', alignContent: 'start', minWidth: 0 }}>
          {viewer.canVerify && current && <ClientDecision inspection={inspection} revision={current} onDone={after} onError={report} />}
          <Fold title="History" meta={`Assigned to ${inspection.inspector.name} · ${inspection.company.name}`}>
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
          </Fold>
          {showSummary && (
            <Fold
              title={<>Summary {statusBadge}</>}
              meta={
                current.summary.length > 0 ? (
                  `${current.summary.length} remark${current.summary.length === 1 ? '' : 's'} or action${current.summary.length === 1 ? '' : 's'}`
                ) : (
                  <span className="proto-all-clear">
                    <Icon name="check" /> No defects or remarks
                  </span>
                )
              }
              defaultOpen={current.summary.length > 0}
            >
              <SummarySection summary={current.summary} vehicle={current.snapshot.vehicle} />
            </Fold>
          )}
          <Fold
            title="Acknowledgement and sign-off"
            meta={myTurn ? 'Waiting for your confirmation' : current ? `Revision ${current.revision}` : 'Opens once the checklist is submitted'}
            defaultOpen={myTurn}
          >
            <SignoffPanel
              inspection={inspection}
              revision={current}
              captions={captionsFrom}
              renderAction={(stage) => {
                const mine = viewer.stages.find((s) => s.stage === stage)
                if (!mine || mine.signed) return null
                if (mine.blockedReason) return <span className="subtle">{mine.blockedReason}</span>
                return <SignAction stage={stage} inspection={inspection} revision={current} session={session} onDone={after} onError={report} />
              }}
            />
          </Fold>
        </div>
      </div>
    </>
  )
}

// Collapsible side-column card (native <details>). Shared cards placed inside
// lose their own frame and heading in CSS; the summary line replaces them.
function Fold({ title, meta, defaultOpen = false, children }) {
  return (
    <details className="card proto-fold" open={defaultOpen}>
      <summary>
        <span className="proto-fold-title">{title}</span>
        {meta && <span className="proto-fold-meta">{meta}</span>}
      </summary>
      {children}
    </details>
  )
}

// Keys of checklist items that need a reviewer's attention: a defect or
// missing mark (by the legend's meaning), or any remark / action text.
function issueKeys(definition, answers) {
  const keys = []
  const visit = (item) => {
    const answer = answers.items?.[item.key]
    const label = definition.statusLegend.find((s) => s.value === answer?.status)?.label
    if (['bad', 'warn'].includes(statusTone(label)) || answer?.remark?.trim() || answer?.action?.trim()) keys.push(item.key)
    item.children?.forEach(visit)
  }
  definition.sections.forEach((section) => section.items.forEach(visit))
  return keys
}

// Read-only checklist with a "Remarks and defects / All items" switch. The
// shared form is left as is; rows without an issue are hidden in CSS by their
// existing `item-<key>` ids.
function IssueFilter({ definition, answers, children }) {
  const issues = useMemo(() => issueKeys(definition, answers), [definition, answers])
  const total = progress(definition, answers).total
  const [onlyIssues, setOnlyIssues] = useState(issues.length > 0)
  const ids = issues.map((key) => `#item-${CSS.escape(key)}`).join(', ')
  return (
    <>
      {/* With nothing to filter there is no bar; the Summary card says "No defects or remarks". */}
      {issues.length > 0 && (
        <div className="card proto-filter">
          <div className="proto-segmented" role="group" aria-label="Show checklist items">
            <button type="button" aria-pressed={onlyIssues} onClick={() => setOnlyIssues(true)}>
              Remarks and defects ({issues.length})
            </button>
            <button type="button" aria-pressed={!onlyIssues} onClick={() => setOnlyIssues(false)}>
              All items ({total})
            </button>
          </div>
          {onlyIssues && <span className="subtle">{Math.max(total - issues.length, 0)} other items hidden</span>}
        </div>
      )}
      <div className={onlyIssues ? 'proto-only-issues' : undefined}>
        {onlyIssues && (
          <style>{`.proto-only-issues .cl-section:not(:has(${ids})), .proto-only-issues .cl-items > li:not(${ids}):not(:has(${ids})) { display: none; }`}</style>
        )}
        {children}
      </div>
    </>
  )
}

// What a live update means, in words (null for reconnects and access changes).
const LIVE_TEXT = {
  created: 'the Mashhor office created this inspection.',
  updated: 'the Mashhor office corrected or reassigned this inspection.',
  saved: 'the inspector saved a draft.',
  submitted: 'the inspector submitted a new revision.',
  returned: 'the client requested a re-check.',
  verified: 'the client verified it and forwarded it for approval.',
  signed: 'a sign-off was confirmed.',
  approved: 'the inspection was approved.',
}
function liveText(event) {
  return event?.type === 'inspection' ? (LIVE_TEXT[event.action] ?? 'it changed.') : null
}

// The inspector's editable form: draft save (nothing required) and submit
// (every applicable field required — checked here first, then by the API).
function FormEditor({ inspection, onSaved, onSubmitted, onError, onDirtyChange }) {
  const { definition } = inspection.working
  const [answers, setAnswers] = useState(inspection.working.answers)
  const [dirty, setDirty] = useState(false)
  const [problems, setProblems] = useState(new Map())
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const nextRevision = inspection.currentRevision + 1
  const done = progress(definition, answers)
  const summary = useMemo(() => buildSummary(inspection.vehicle, definition, answers), [inspection.vehicle, definition, answers])

  // The page holds live reloads back while there are unsaved changes.
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

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
      onError(err)
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
      onSubmitted(result)
    } catch (err) {
      setConfirming(false)
      if (err.data?.problems?.length) showProblems(err.data.problems)
      else onError(err)
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
        diagramUrl={diagramUrl(inspection.id, definition)}
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
      onError(err)
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
    <section className="card proto-decision" aria-labelledby="verify-title">
      <div className="card-head">
        <div>
          <h2 id="verify-title">Actions</h2>
        </div>
      </div>
      <div className="card-body proto-decision-actions">
        <button type="button" className="btn btn-primary" onClick={() => setDialog('forward')}>
          Send to Head of Operation <Icon name="next" />
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setReason('')
            setReasonError('')
            setDialog('recheck')
          }}
        >
          <Icon name="back" /> Request Re-check
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
        title="Send to the Head of Operation?"
        description={`You confirm revision ${revisionNumber} as verified. It goes to the Head of Operation for approval and can no longer be returned from here.`}
        confirmLabel="Send to Head of Operation"
        busy={busy}
        onConfirm={() => send('verify', {}, `Revision ${revisionNumber} sent to the Head of Operation for approval.`)}
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
        onError(err)
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
