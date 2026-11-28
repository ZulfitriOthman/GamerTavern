// Printable record of ONE submitted revision: submission, client decision,
// acknowledgement, every recorded confirmation (as text — never an imitation
// signature) and the history that belongs to that revision. Rendered as an
// extra A4 sheet after the checklist print, so an earlier revision prints with
// its own history and confirmations rather than the current ones.
import { formatDate } from '@mashoor/shared/format'
import { EVENT_LABELS, INSPECTION_STATUS, STAGE_LABELS } from '@mashoor/shared/inspection'
import { eventsForRevision } from './revisionEvents.js'

const STAGES = ['checked_by', 'agreed_by', 'approved_by', 'acknowledgement']
const ACK_TEXT = {
  pending: 'Pending — the revision contains remarks',
  auto: 'Auto-acknowledged — no remarks. (System action; not an approval.)',
  acknowledged: 'Acknowledged',
}

export function RevisionRecord({ inspection, revision, printedAt }) {
  const events = eventsForRevision(inspection.events, revision.revision)
  const signed = Object.fromEntries(revision.signoffs.map((s) => [s.stage, s]))
  const recheck = events.find((e) => e.action === 'recheck_requested')
  const status = INSPECTION_STATUS[inspection.status]?.label ?? inspection.status

  let decision = 'Not yet verified by the client.'
  if (revision.verifiedBy) decision = `Verified and submitted to Head of Operations approval by ${revision.verifiedBy.name} · ${formatDate(revision.verifiedBy.at)}`
  else if (recheck) decision = `Returned for re-check by ${recheck.actorName ?? 'the client'} · ${formatDate(recheck.at)} — “${recheck.detail}”`

  return (
    <div className="print-doc">
      <article className="sheet break proto-record">
        <h2 className="p-h2">
          Revision {revision.revision} — submission record
        </h2>
        <p className={revision.current ? 'proto-record-state' : 'p-draft'}>
          {revision.current
            ? `Current revision · inspection status: ${status}`
            : `SUPERSEDED — replaced by revision ${inspection.currentRevision}. Shown exactly as submitted, with its own decisions and confirmations.`}
        </p>

        <table className="p-details proto-record-table">
          <tbody>
            <tr>
              <th>Inspection</th>
              <td>
                #{inspection.id} · {inspection.company.name} · {inspection.templateName}
              </td>
            </tr>
            <tr>
              <th>Submitted</th>
              <td>
                {formatDate(revision.submittedAt)}
                {revision.submittedBy ? ` by ${revision.submittedBy.name}` : ''}
              </td>
            </tr>
            <tr>
              <th>Client verification</th>
              <td>{decision}</td>
            </tr>
            <tr>
              <th>Acknowledgement</th>
              <td>
                {ACK_TEXT[revision.acknowledgement] ?? revision.acknowledgement}
                {signed.acknowledgement && ` by ${signed.acknowledgement.name} · ${formatDate(signed.acknowledgement.signedAt)}`}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="proto-record-h3">Recorded confirmations</h3>
        <table className="p-summary">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Confirmed by (full name on the account)</th>
              <th>Date and time</th>
              <th>Revision</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((stage) => {
              const s = signed[stage]
              const auto = stage === 'acknowledgement' && revision.acknowledgement === 'auto'
              return (
                <tr key={stage}>
                  <td>{STAGE_LABELS[stage]}</td>
                  <td>{s ? s.name : auto ? 'System — auto-acknowledged (no remarks)' : <span className="p-pending">Not confirmed</span>}</td>
                  <td>{s ? formatDate(s.signedAt) : '—'}</td>
                  <td>{s || auto ? revision.revision : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <h3 className="proto-record-h3">History of this revision</h3>
        <table className="p-summary">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Who</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.at)}</td>
                <td>{EVENT_LABELS[e.action] ?? e.action}</td>
                <td>{e.actorType === 'system' ? 'System' : (e.actorName ?? 'Mashhor office')}</td>
                <td className="prewrap">{e.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="p-meta">
          Confirmations are recorded digitally against the signed-in portal account (name, date and time, revision); they are not handwritten
          signatures. Times are shown in this device’s local time. Prepared {printedAt}.
        </p>
      </article>
    </div>
  )
}
