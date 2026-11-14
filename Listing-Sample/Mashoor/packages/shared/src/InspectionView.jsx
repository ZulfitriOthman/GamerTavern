// Read-only building blocks for a vehicle inspection, shared by the admin site
// and the vendor portal. Everything shown comes from the API; nothing is
// inferred or filled in.
import { formatDate } from './format.js'
import { EVENT_LABELS, INSPECTION_STATUS, STAGE_LABELS, vehicleTitle } from './inspection.js'
import { Icon } from './Icon.jsx'

export function InspectionStatusBadge({ status }) {
  const s = INSPECTION_STATUS[status] ?? { label: status, tone: '' }
  return <span className={`badge ${s.tone}`.trim()}>{s.label}</span>
}

export function VehicleTitle({ vehicle }) {
  return <>{vehicleTitle(vehicle)}</>
}

export function VehicleCard({ inspection }) {
  const v = inspection.vehicle
  return (
    <section className="card" aria-labelledby="vehicle-title">
      <div className="card-head">
        <div>
          <h2 id="vehicle-title">Vehicle</h2>
          <p>{inspection.templateName}</p>
        </div>
      </div>
      <div className="card-body">
        <dl className="dl">
          <div>
            <dt>Vehicle type</dt>
            <dd>{v.type}</dd>
          </div>
          <div>
            <dt>Vehicle plate</dt>
            <dd>{v.plate || '—'}</dd>
          </div>
          <div>
            <dt>Vehicle registration no.</dt>
            <dd>{v.registrationNo || '—'}</dd>
          </div>
          <div>
            <dt>MOD registration no.</dt>
            <dd>{v.modRegistrationNo || '—'}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{inspection.company.name}</dd>
          </div>
          <div>
            <dt>Inspector</dt>
            <dd>{inspection.inspector.name}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

// Every remark/action exactly as entered, with the vehicle and item it belongs to.
export function SummarySection({ summary, vehicle, title = 'Summary' }) {
  return (
    <section className="card" aria-labelledby="summary-title">
      <div className="card-head">
        <div>
          <h2 id="summary-title">{title}</h2>
          <p>Remarks and actions recorded on this checklist for {vehicleTitle(vehicle)}.</p>
        </div>
        <span className="badge plain num">{summary.length} entr{summary.length === 1 ? 'y' : 'ies'}</span>
      </div>
      {summary.length === 0 ? (
        <div className="card-body">
          <p className="muted">No remarks or actions were recorded.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col">Checklist item</th>
                <th scope="col">Status</th>
                <th scope="col">Remark</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((entry) => (
                <tr key={entry.itemKey}>
                  <td data-label="">
                    <span className="cell-main">
                      <span className="cell-title">{vehicleTitle(entry.vehicle)}</span>
                      <span className="cell-sub">
                        {[entry.vehicle.registrationNo && `Reg. ${entry.vehicle.registrationNo}`, entry.vehicle.modRegistrationNo && `MOD ${entry.vehicle.modRegistrationNo}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </td>
                  <td data-label="Item">
                    <span className="cell-main">
                      <span>
                        {entry.number && <span className="num">{entry.number} </span>}
                        {entry.label}
                      </span>
                      {entry.section && <span className="cell-sub">{entry.section}</span>}
                    </span>
                  </td>
                  <td data-label="Status">
                    {entry.status ? (
                      <span title={entry.statusLabel ?? undefined}>
                        {entry.status}
                        {entry.statusLabel && entry.statusLabel !== entry.status && <span className="subtle"> · {entry.statusLabel}</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Remark" className="prewrap">
                    {entry.remark || <span className="muted">—</span>}
                  </td>
                  <td data-label="Action" className="prewrap">
                    {entry.action || <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const ACK_TEXT = {
  pending: ['Pending', 'warning'],
  auto: ['Auto-acknowledged — no remarks', 'success'],
  acknowledged: ['Acknowledged', 'success'],
}

// Acknowledgement + Checked by / Agreed by / Approved by for one revision.
// `renderAction(stage)` lets the portal add a Confirm button for the viewer.
export function SignoffPanel({ inspection, revision, renderAction, captions }) {
  const byStage = Object.fromEntries((revision?.signoffs ?? []).map((s) => [s.stage, s]))
  const assignee = Object.fromEntries(inspection.signatories.map((s) => [s.stage, s.assignee]))
  const [ackLabel, ackTone] = revision ? ACK_TEXT[revision.acknowledgement] : ['Not submitted yet', '']
  const stages = ['acknowledgement', 'checked_by', 'agreed_by', 'approved_by']
  return (
    <section className="card" aria-labelledby="signoff-panel-title">
      <div className="card-head">
        <div>
          <h2 id="signoff-panel-title">Acknowledgement and sign-off</h2>
          <p>{revision ? `For revision ${revision.revision}, submitted ${formatDate(revision.submittedAt)}.` : 'Opens once the checklist is submitted.'}</p>
        </div>
      </div>
      <ul className="signoffs">
        {stages.map((stage) => {
          const signed = byStage[stage]
          const who = assignee[stage]
          let state
          if (stage === 'acknowledgement' && revision?.acknowledgement === 'auto') {
            state = <span className={`badge ${ackTone}`}>{ackLabel}</span>
          } else if (signed) {
            state = <span className="badge success">Confirmed</span>
          } else {
            state = <span className={`badge ${stage === 'acknowledgement' && revision ? ackTone : ''}`.trim()}>Pending</span>
          }
          return (
            <li key={stage} className="signoff">
              <div className="signoff-main">
                <span className="signoff-stage">
                  {STAGE_LABELS[stage]}
                  {/* Role caption from the paper form only; the person is whoever is assigned below. */}
                  {captions?.[stage]?.caption && stage !== 'approved_by' && <span className="subtle"> — {captions[stage].caption}</span>}
                </span>
                <span className="subtle">
                  {who ? `Assigned to ${who.name}${who.active ? '' : ' (deactivated)'}` : 'Not assigned — ask Mashoor staff to assign this stage'}
                </span>
                {signed && (
                  <span className="signoff-by">
                    <Icon name="check" /> {signed.name} · {formatDate(signed.signedAt)}
                  </span>
                )}
                {stage === 'acknowledgement' && revision?.acknowledgement === 'auto' && (
                  <span className="subtle">Recorded automatically by the system because the checklist has no remarks.</span>
                )}
              </div>
              <div className="signoff-side">
                {state}
                {renderAction?.(stage)}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function EventTimeline({ events }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e, i) => (
        <li key={i}>
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <strong>{EVENT_LABELS[e.action] ?? e.action}</strong>
            <span className="subtle">
              {' '}
              {e.actorType === 'system' ? 'System' : e.actorName ?? 'Mashoor staff'} · {formatDate(e.at)}
              {e.revision ? ` · revision ${e.revision}` : ''}
            </span>
            {e.detail && <p className="timeline-detail prewrap">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function RevisionHistory({ revisions, renderLink }) {
  const older = revisions.filter((r) => !r.current)
  if (!older.length) return null
  return (
    <ul className="status-list">
      {older.map((r) => (
        <li key={r.revision}>
          <span>
            Revision {r.revision} <span className="subtle">· submitted {formatDate(r.submittedAt)}</span>
          </span>
          <span className="subtle">
            {r.signoffs.length ? r.signoffs.map((s) => `${STAGE_LABELS[s.stage]}: ${s.name}`).join(' · ') : 'No sign-offs'} — superseded
            {renderLink && <> · {renderLink(r)}</>}
          </span>
        </li>
      ))}
    </ul>
  )
}
