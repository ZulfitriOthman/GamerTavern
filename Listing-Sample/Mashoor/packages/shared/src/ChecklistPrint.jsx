// A4 print layout following the client's paper form: document header,
// vehicle-details box, the two-column checklist table with the status legend,
// remarks / next servicing, sign-off lines, then the summary and the damage
// diagram page. Sign-off lines show the digital confirmations recorded in
// Mashoor (name, time, revision) — never an imitation of a handwritten signature.
import { DETAIL_FIELDS, buildSummary, measurementTitle } from './checklist.js'
import { DocumentHeader, StatusLegend } from './ChecklistForm.jsx'
import { formatDate } from './format.js'

const STAGE_TITLE = { checked_by: 'Checked by', agreed_by: 'Agreed by', approved_by: 'Approved By' }
const ACK_TEXT = {
  pending: 'Acknowledgement pending',
  auto: 'Auto-acknowledged — no remarks (recorded by the system)',
  acknowledged: 'Acknowledged',
}

function measurementLine(m, values) {
  if (m.layout === 'single') return values?.value ? `${values.value}${m.unit ? ` ${m.unit}` : ''}` : ''
  const v = (pos) => values?.[pos] ?? ''
  return `Front: R ${v('front_r') || '____'}  L ${v('front_l') || '____'}  |  Rear: R ${v('rear_r') || '____'}  L ${v('rear_l') || '____'}`
}

function ColumnTable({ sections, answers }) {
  const rows = []
  for (const section of sections) {
    rows.push(
      <tr key={section.key} className="p-section">
        <td className="p-no">{section.number}</td>
        <td className="p-desc">
          <u>{section.title}</u>
        </td>
        <td className="p-status" />
      </tr>,
    )
    for (const item of section.items) {
      const answer = answers.items?.[item.key] ?? {}
      const single = item.measurements.find((m) => m.layout === 'single')
      rows.push(
        <tr key={item.key}>
          <td className="p-no">{item.number}</td>
          <td className="p-desc">
            {item.label}
            {single && <span className="p-box">{measurementLine(single, answer.measurements?.[single.key])}</span>}
          </td>
          <td className="p-status">{item.status ? answer.status ?? '' : ''}</td>
        </tr>,
      )
      for (const m of item.measurements.filter((x) => x.layout === 'axle')) {
        rows.push(
          <tr key={`${item.key}-${m.key}-h`} className="p-measure-head">
            <td className="p-no" />
            <td className="p-desc">
              <strong>{measurementTitle(m, item)}</strong>
            </td>
            <td className="p-status" />
          </tr>,
          <tr key={`${item.key}-${m.key}`} className="p-measure">
            <td className="p-no" />
            <td className="p-desc num">{measurementLine(m, answer.measurements?.[m.key])}</td>
            <td className="p-status" />
          </tr>,
        )
      }
      for (const child of item.children ?? []) {
        const ca = answers.items?.[child.key] ?? {}
        rows.push(
          <tr key={child.key}>
            <td className="p-no" />
            <td className="p-desc p-child">– {child.label}</td>
            <td className="p-status">{child.status ? ca.status ?? '' : ''}</td>
          </tr>,
        )
      }
    }
  }
  return (
    <table className="p-table">
      <thead>
        <tr>
          <th colSpan={2}>Description</th>
          <th className="p-status">Status</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  )
}

export function ChecklistPrint({ definition, answers, vehicle, meta, revision, signatories, diagramUrl }) {
  const left = definition.sections.filter((s) => s.column !== 2)
  const right = definition.sections.filter((s) => s.column === 2)
  const summary = buildSummary(vehicle, definition, answers)
  const signed = Object.fromEntries((revision?.signoffs ?? []).map((s) => [s.stage, s]))
  const assignee = Object.fromEntries((signatories ?? []).map((s) => [s.stage, s.assignee]))
  const detail = (key) => answers.details?.[key] ?? ''
  const hasDetail = (key) => definition.details.some((d) => d.key === key)
  const damage = answers.damage ?? { markers: [] }

  const signLine = (stage) => {
    const s = signed[stage]
    const cfg = definition.signoff?.[stage] ?? {}
    return (
      <div className={`p-sign p-sign-${stage}`} key={stage}>
        <div className="p-sign-title">{STAGE_TITLE[stage]} :</div>
        <div className="p-sign-line">
          {s ? (
            <>
              <strong>{s.name}</strong>
              <span>
                Confirmed digitally · {formatDate(s.signedAt)} · revision {revision.revision}
              </span>
            </>
          ) : (
            <span className="p-pending">
              {revision ? 'Pending' : 'Not submitted'}
              {assignee[stage] ? ` — assigned to ${assignee[stage].name}` : ''}
            </span>
          )}
        </div>
        {cfg.printedName && <div className="p-sign-name">{cfg.printedName}</div>}
        {cfg.caption && <div className="p-sign-caption">({cfg.caption})</div>}
      </div>
    )
  }

  return (
    <div className="print-doc">
      <article className="sheet">
        <DocumentHeader header={definition.header} />
        {!revision && <p className="p-draft">DRAFT — not submitted. Values may still change.</p>}

        <table className="p-details">
          <tbody>
            <tr>
              <th>MOD Reg. No.</th>
              <td>{vehicle.modRegistrationNo ?? ''}</td>
              <th>{DETAIL_FIELDS.date} :</th>
              <td>{hasDetail('date') ? detail('date') : ''}</td>
            </tr>
            <tr>
              <th>{DETAIL_FIELDS.model}</th>
              <td>{detail('model')}</td>
              <th>{DETAIL_FIELDS.location} :</th>
              <td>{detail('location')}</td>
            </tr>
            <tr>
              <th>{DETAIL_FIELDS.mileage}</th>
              <td>{detail('mileage')}</td>
              <th>{DETAIL_FIELDS.divProject}</th>
              <td>{detail('divProject')}</td>
            </tr>
            <tr className="p-extra">
              <th>Vehicle plate</th>
              <td>{vehicle.plate ?? ''}</td>
              <th>Vehicle reg. no. / type</th>
              <td>
                {[vehicle.registrationNo, vehicle.type].filter(Boolean).join(' · ')}
              </td>
            </tr>
          </tbody>
        </table>

        <div className={`p-columns${right.length ? '' : ' single'}`}>
          <ColumnTable sections={left} answers={answers} />
          {right.length > 0 && <ColumnTable sections={right} answers={answers} />}
        </div>
        <StatusLegend legend={definition.statusLegend} />

        {definition.footer.remarks && (
          <div className="p-block">
            <h3>Remarks / Comments:</h3>
            <p className="p-lines prewrap">{answers.remarks || ' '}</p>
          </div>
        )}
        {definition.footer.nextServicing && (
          <div className="p-block">
            <h3>
              <i>NEXT SERVICING :</i>
            </h3>
            <p className="p-lines prewrap">{answers.nextServicing || ' '}</p>
          </div>
        )}

        <div className="p-signs">
          {signLine('checked_by')}
          {signLine('agreed_by')}
        </div>
        <div className="p-signs center">{signLine('approved_by')}</div>
        <p className="p-ack">
          {revision ? ACK_TEXT[revision.acknowledgement] : 'Acknowledgement opens once the checklist is submitted.'}
          {revision?.acknowledgement === 'acknowledged' && signed.acknowledgement && ` by ${signed.acknowledgement.name} · ${formatDate(signed.acknowledgement.signedAt)}`}
        </p>
        <p className="p-meta">
          {meta.companyName} · Inspection #{meta.inspectionId} · {meta.templateName}
          {meta.templateVersion ? ` (template v${meta.templateVersion})` : ''}
          {revision ? ` · Revision ${revision.revision}, submitted ${formatDate(revision.submittedAt)}${revision.submittedBy ? ` by ${revision.submittedBy.name}` : ''}` : ''}
          {' · '}Sign-offs are digital confirmations recorded in Mashoor, not handwritten signatures.
        </p>
      </article>

      <article className="sheet break">
        <h2 className="p-h2">Summary — remarks and actions</h2>
        {summary.length === 0 ? (
          <p className="muted">No remarks or actions were recorded on checklist items.</p>
        ) : (
          <table className="p-summary">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Item</th>
                <th>Status</th>
                <th>Remark</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((e) => (
                <tr key={e.itemKey}>
                  <td>
                    {[vehicle.modRegistrationNo, vehicle.plate, vehicle.registrationNo].filter(Boolean).join(' / ')}
                  </td>
                  <td>
                    {e.number} {e.label}
                  </td>
                  <td>{e.status ?? ''}</td>
                  <td className="prewrap">{e.remark}</td>
                  <td className="prewrap">{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {definition.damage?.enabled && (
          <div className="p-damage">
            {definition.damage.note && <p className="p-note">Note : {definition.damage.note}</p>}
            {diagramUrl && (
              <div className="p-diagram">
                <img src={diagramUrl} alt={`${vehicle.type} damage diagram`} />
                {damage.markers.map((m, i) => (
                  <span key={m.id} className="marker" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
                    {i + 1}
                  </span>
                ))}
              </div>
            )}
            {damage.markers.length > 0 && (
              <ol className="p-markers">
                {damage.markers.map((m, i) => (
                  <li key={m.id}>
                    <strong>{i + 1}.</strong> {m.note || '—'}
                  </li>
                ))}
              </ol>
            )}
            <div className="p-extent">
              <span>Extent of damage:</span>
              {definition.damage.extentOptions.map((o) => (
                <span key={o} className="p-checkbox">
                  <span className="box" aria-hidden="true">
                    {damage.extent === o ? '✕' : ''}
                  </span>
                  {o}
                  {damage.extent === o && <span className="visually-hidden"> (selected)</span>}
                </span>
              ))}
            </div>
            <div className="p-block">
              <h3>Notes / Remarks :</h3>
              <p className="p-lines prewrap">{damage.notes || ' '}</p>
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
