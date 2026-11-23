// A4 print view used by both prototype apps. Built on the existing shared
// ChecklistPrint (header, details, two-column checklist with legend, remarks,
// sign-off lines with recorded confirmations, summary, damage page) and adds:
//   - a revision picker, so any earlier submitted revision can be printed;
//   - a "superseded" banner printed on the first sheet of an earlier revision;
//   - a submission-record sheet with that revision's own decisions,
//     confirmations and history (RevisionRecord).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { ChecklistPrint } from '@mashoor/shared/ChecklistPrint'
import { EmptyState, Loading } from '@mashoor/shared/ui'
import { RevisionRecord } from './RevisionRecord.jsx'

export function InspectionPrintPage({ api, diagramUrl }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const wanted = params.get('revision')
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { inspection } = await api(`/inspections/${id}`)
        const revision = wanted
          ? (await api(`/inspections/${id}/revisions/${encodeURIComponent(wanted)}`)).revision
          : (inspection.revisions.find((r) => r.current) ?? null)
        if (!cancelled) setState({ inspection, revision, printedAt: new Date().toLocaleString() })
      } catch (error) {
        if (!cancelled) setState({ error })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, id, wanted])

  const { inspection, revision } = state
  const toolbar = (
    <div className="print-toolbar">
      <Link className="btn" to={`/inspections/${id}`}>
        <Icon name="back" /> Back to inspection
      </Link>
      {inspection?.revisions.length > 0 && (
        <label className="proto-revision-pick">
          <span className="subtle">Revision</span>
          <select
            className="select"
            value={revision ? String(revision.revision) : ''}
            onChange={(e) => navigate(`/inspections/${id}/print?revision=${e.target.value}`)}
          >
            {!revision && <option value="">Working draft</option>}
            {inspection.revisions.map((r) => (
              <option key={r.revision} value={r.revision}>
                Revision {r.revision}
                {r.current ? ' (current)' : ' (superseded)'}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="grow subtle">A4 layout. Use the browser’s print dialog (Ctrl+P) to print or save as PDF.</span>
      {inspection && (
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print
        </button>
      )}
    </div>
  )

  if (state.loading) {
    return (
      <>
        {toolbar}
        <Loading label="Preparing print view…" />
      </>
    )
  }
  if (state.error) {
    return (
      <>
        {toolbar}
        <div className="card">
          <EmptyState tone={state.error.status === 404 ? undefined : 'error'} title="Nothing to print">
            {state.error.status === 404 ? 'This inspection or revision isn’t available to you.' : state.error.message}
          </EmptyState>
        </div>
      </>
    )
  }

  const form = revision ? revision.snapshot : inspection.working ? { ...inspection.working, vehicle: inspection.vehicle } : null
  if (!form) {
    return (
      <>
        {toolbar}
        <div className="card">
          <EmptyState title="Not submitted yet">The print view is available once the inspector submits the checklist.</EmptyState>
        </div>
      </>
    )
  }
  const superseded = revision && !revision.current
  return (
    <>
      {toolbar}
      <div
        className={superseded ? 'proto-superseded' : undefined}
        style={superseded ? { '--proto-banner': `"SUPERSEDED — revision ${revision.revision} of ${inspection.currentRevision}. Printed as submitted."` } : undefined}
      >
        <ChecklistPrint
          definition={form.definition}
          answers={form.answers}
          vehicle={form.vehicle}
          revision={revision}
          // An earlier revision shows only its own confirmations — not today's assignees.
          signatories={superseded ? [] : inspection.signatories}
          diagramUrl={diagramUrl(inspection.id, form.definition)}
          meta={{
            inspectionId: inspection.id,
            companyName: inspection.company.name,
            templateName: form.templateName ?? inspection.templateName,
            templateVersion: form.templateVersion ?? inspection.templateVersion,
          }}
        />
      </div>
      {revision && <RevisionRecord inspection={inspection} revision={revision} printedAt={state.printedAt} />}
    </>
  )
}
