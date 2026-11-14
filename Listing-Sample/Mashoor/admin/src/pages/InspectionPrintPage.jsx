import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { ChecklistPrint } from '@mashoor/shared/ChecklistPrint'
import { EmptyState, Loading } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { diagramUrl } from '../diagramUrl.js'

// A4 print view for staff: current revision, ?revision=N, or the unsubmitted draft (marked as a draft).
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
        const revision = wanted
          ? (await api(`/inspections/${id}/revisions/${encodeURIComponent(wanted)}`)).revision
          : (inspection.revisions.find((r) => r.current) ?? null)
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
      <span className="grow subtle">A4 layout. Use the browser’s print dialog to print or save as PDF.</span>
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
          <EmptyState tone="error" title="Nothing to print">
            {state.error.message}
          </EmptyState>
        </div>
      </>
    )
  }
  const { inspection, revision } = state
  const form = revision ? revision.snapshot : { ...inspection.working, vehicle: inspection.vehicle }
  return (
    <>
      {toolbar}
      <ChecklistPrint
        definition={form.definition}
        answers={form.answers}
        vehicle={form.vehicle}
        revision={revision}
        signatories={inspection.signatories}
        diagramUrl={form.definition.damage?.enabled ? diagramUrl(form.definition.damage.diagramId) : null}
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
