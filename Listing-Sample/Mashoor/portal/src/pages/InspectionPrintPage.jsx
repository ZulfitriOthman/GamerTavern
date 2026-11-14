import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { ChecklistPrint } from '@mashoor/shared/ChecklistPrint'
import { EmptyState, Loading } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { diagramUrlFor } from '../inspectionUrls.js'

// A4 print view. Shows the current submitted revision, an earlier one
// (?revision=N), or — for the assigned inspector before submitting — the
// working draft, clearly marked as a draft.
export default function InspectionPrintPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const wanted = params.get('revision')
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { inspection } = await api(`/inspections/${id}`)
        let revision = null
        if (wanted) revision = (await api(`/inspections/${id}/revisions/${encodeURIComponent(wanted)}`)).revision
        else revision = inspection.revisions.find((r) => r.current) ?? null
        if (!cancelled) setState({ inspection, revision })
      } catch (error) {
        if (!cancelled) setState({ error })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, wanted])

  const toolbar = (
    <div className="print-toolbar">
      <Link className="btn" to={`/inspections/${id}`}>
        <Icon name="back" /> Back to inspection
      </Link>
      <span className="grow subtle">A4 layout. Use your browser’s print dialog to print or save as PDF.</span>
      {state.inspection && (
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

  const { inspection, revision } = state
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
  return (
    <>
      {toolbar}
      <ChecklistPrint
        definition={form.definition}
        answers={form.answers}
        vehicle={form.vehicle}
        revision={revision}
        signatories={inspection.signatories}
        diagramUrl={diagramUrlFor(inspection.id, form.definition)}
        meta={{
          inspectionId: inspection.id,
          companyName: inspection.company.name,
          templateName: form.templateName ?? inspection.templateName,
          templateVersion: form.templateVersion ?? inspection.templateVersion,
        }}
      />
    </>
  )
}
