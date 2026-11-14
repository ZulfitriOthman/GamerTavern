// The vehicle checklist as an interactive form, rendered from a template
// definition (see Backend/mashoor/src/checklist/definition.js). Used for the
// inspector's editable checklist, the read-only review of a submitted
// revision, and the admin template preview.
//
// Screen layout follows the paper form's order (document header, vehicle
// details, numbered sections, remarks / next servicing, damage page) but each
// section is its own card, and on narrow screens every item stacks — the paper
// table is never shrunk until unreadable. The A4 layout is ChecklistPrint.jsx.
import { useId, useState } from 'react'
import { Icon } from './Icon.jsx'
import { DamageDiagram } from './DamageDiagram.jsx'
import {
  DETAIL_FIELDS,
  EXTENT_OPTIONS,
  MEASUREMENT_LAYOUTS,
  POSITION_LABELS,
  allItems,
  measurementTitle,
  statusTone,
  withItemAnswer,
  withMeasurement,
} from './checklist.js'
import logoHmm from './assets/logo-hmm.jpg'
import logoMashhor from './assets/logo-mashhor.jpg'

export function DocumentHeader({ header, compact }) {
  if (!header || (!header.companyName && !header.title && !header.subtitle)) return null
  return (
    <div className={`doc-header${compact ? ' compact' : ''}`}>
      {header.showLogos && <img className="doc-logo" src={logoHmm} alt="HMM logo" />}
      <div className="doc-header-text">
        {header.companyName && <p className="doc-company">{header.companyName}</p>}
        {header.title && <p className="doc-title">{header.title}</p>}
        {header.subtitle && <p className="doc-subtitle">{header.subtitle}</p>}
      </div>
      {header.showLogos && <img className="doc-logo" src={logoMashhor} alt="Mashhor Group of Companies logo" />}
    </div>
  )
}

export function StatusLegend({ legend }) {
  if (!legend?.length) return null
  return (
    <p className="legend">
      <span className="legend-title">Mark:</span>
      {legend.map((s) => (
        <span key={s.value} className="legend-entry">
          <span className={`mark tone-${statusTone(s.label)}`}>{s.value}</span> {s.label}
        </span>
      ))}
    </p>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return (
    <span className="field-error">
      <Icon name="alert" /> {message}
    </span>
  )
}

function StatusPicker({ legend, value, onChange, readOnly, labelId, error }) {
  const name = useId()
  if (readOnly) {
    const entry = legend.find((s) => s.value === value)
    return value ? (
      <span className={`status-chip tone-${statusTone(entry?.label)}`} title={entry?.label}>
        <span className="mark">{value}</span> {entry?.label ?? ''}
      </span>
    ) : (
      <span className="status-chip empty">Not answered</span>
    )
  }
  return (
    <div className={`status-pick${error ? ' invalid' : ''}`} role="radiogroup" aria-labelledby={labelId} aria-invalid={error ? 'true' : undefined}>
      {legend.map((s) => (
        <label key={s.value} className={`status-opt tone-${statusTone(s.label)}`} title={s.label}>
          <input type="radio" name={name} value={s.value} checked={value === s.value} onChange={() => onChange(s.value)} />
          <span className="mark" aria-hidden="true">
            {s.value}
          </span>
          <span className="status-meaning">{s.label}</span>
        </label>
      ))}
    </div>
  )
}

function Measurements({ item, answer, readOnly, onChange, problems }) {
  return (
    <div className="measures">
      {item.measurements.map((m) => {
        const values = answer.measurements?.[m.key] ?? {}
        const title = measurementTitle(m, item)
        if (m.layout === 'single') {
          const err = problems?.get(`item.${item.key}.m.${m.key}.value`)
          return (
            <div key={m.key} className="measure single">
              {m.label && <span className="measure-title">{title}</span>}
              {readOnly ? (
                <span className="measure-value">
                  {values.value ? `${values.value}${m.unit ? ` ${m.unit}` : ''}` : <span className="muted">—</span>}
                </span>
              ) : (
                <span className="measure-input">
                  <input
                    className="input"
                    inputMode="decimal"
                    value={values.value ?? ''}
                    aria-label={`${title} reading`}
                    aria-invalid={err ? 'true' : undefined}
                    onChange={(e) => onChange(m.key, 'value', e.target.value)}
                  />
                  {m.unit && <span className="unit">{m.unit}</span>}
                </span>
              )}
              <FieldError message={err} />
            </div>
          )
        }
        return (
          <fieldset key={m.key} className="measure axle">
            <legend className="measure-title">
              {title}
              {m.required && !readOnly && <span className="req" aria-hidden="true"> *</span>}
            </legend>
            {['Front', 'Rear'].map((axle) => (
              <div key={axle} className="axle-row">
                <span className="axle-name">{axle}:</span>
                {MEASUREMENT_LAYOUTS.axle
                  .filter(([pos]) => pos.startsWith(axle.toLowerCase()))
                  .map(([pos, side]) => {
                    const err = problems?.get(`item.${item.key}.m.${m.key}.${pos}`)
                    return (
                      <label key={pos} className="axle-cell">
                        <span className="side">{side}</span>
                        {readOnly ? (
                          <span className="measure-value">{values[pos] ? values[pos] : <span className="muted">—</span>}</span>
                        ) : (
                          <input
                            className="input"
                            inputMode="decimal"
                            value={values[pos] ?? ''}
                            aria-label={`${title}, ${POSITION_LABELS[pos]}`}
                            aria-invalid={err ? 'true' : undefined}
                            onChange={(e) => onChange(m.key, pos, e.target.value)}
                          />
                        )}
                      </label>
                    )
                  })}
              </div>
            ))}
          </fieldset>
        )
      })}
    </div>
  )
}

function RemarkAction({ item, answer, readOnly, onChange, forceOpen }) {
  const [open, setOpen] = useState(false)
  const hasText = Boolean(answer.remark || answer.action)
  if (readOnly) {
    if (!hasText) return null
    return (
      <dl className="remark-action">
        {answer.remark && (
          <div>
            <dt>Remark</dt>
            <dd className="prewrap">{answer.remark}</dd>
          </div>
        )}
        {answer.action && (
          <div>
            <dt>Action</dt>
            <dd className="prewrap">{answer.action}</dd>
          </div>
        )}
      </dl>
    )
  }
  if (!open && !hasText && !forceOpen) {
    return (
      <button type="button" className="btn-link add-remark" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Remark / action
      </button>
    )
  }
  return (
    <div className="remark-action editing">
      <label>
        <span className="field-label">Remark</span>
        <textarea
          className="textarea"
          rows={2}
          maxLength={1000}
          value={answer.remark ?? ''}
          aria-label={`Remark for ${item.label}`}
          onChange={(e) => onChange({ remark: e.target.value })}
        />
      </label>
      <label>
        <span className="field-label">Action</span>
        <textarea
          className="textarea"
          rows={2}
          maxLength={1000}
          value={answer.action ?? ''}
          aria-label={`Action for ${item.label}`}
          onChange={(e) => onChange({ action: e.target.value })}
        />
      </label>
    </div>
  )
}

function ItemRow({ item, parent, definition, answers, onChange, readOnly, problems }) {
  const labelId = useId()
  const answer = answers.items?.[item.key] ?? {}
  const statusError = problems?.get(`item.${item.key}.status`)
  const isGroup = !item.status && !item.measurements.length && (item.children?.length ?? 0) > 0
  const set = (patch) => onChange(withItemAnswer(answers, item.key, patch))
  return (
    <li className={`cl-item${parent ? ' child' : ''}${isGroup ? ' group' : ''}${statusError ? ' invalid' : ''}`} id={`item-${item.key}`}>
      <div className="cl-item-main">
        <span className="cl-num">{parent ? '–' : item.number}</span>
        <span className="cl-label" id={labelId}>
          {item.label}
        </span>
        {item.status && (
          <div className="cl-status">
            <StatusPicker
              legend={definition.statusLegend}
              value={answer.status}
              readOnly={readOnly}
              labelId={labelId}
              error={statusError}
              onChange={(status) => set({ status })}
            />
            <FieldError message={statusError && 'Choose a status.'} />
          </div>
        )}
      </div>
      {item.measurements.length > 0 && (
        <Measurements
          item={item}
          answer={answer}
          readOnly={readOnly}
          problems={problems}
          onChange={(mKey, pos, value) => onChange(withMeasurement(answers, item.key, mKey, pos, value))}
        />
      )}
      {!isGroup && <RemarkAction item={item} answer={answer} readOnly={readOnly} onChange={set} />}
      {item.children?.length > 0 && (
        <ol className="cl-children">
          {item.children.map((child) => (
            <ItemRow key={child.key} item={child} parent={item} definition={definition} answers={answers} onChange={onChange} readOnly={readOnly} problems={problems} />
          ))}
        </ol>
      )}
    </li>
  )
}

export function VehicleDetails({ definition, answers, vehicle, onChange, readOnly, problems }) {
  const fixed = [
    ['MOD Reg. No.', vehicle?.modRegistrationNo],
    ['Vehicle plate', vehicle?.plate],
    ['Vehicle registration no.', vehicle?.registrationNo],
    ['Vehicle type', vehicle?.type],
  ]
  const setDetail = (key, value) => onChange({ ...answers, details: { ...answers.details, [key]: value } })
  return (
    <section className="card" aria-labelledby="vehicle-details-title">
      <div className="card-head">
        <div>
          <h2 id="vehicle-details-title">Vehicle details</h2>
          {!readOnly && <p>Vehicle identifiers are set when the inspection is assigned. Pre-filled values are defaults — change them if they don’t apply.</p>}
        </div>
      </div>
      <div className="card-body">
        <dl className="detail-grid">
          {fixed.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || <span className="muted">—</span>}</dd>
            </div>
          ))}
        </dl>
        {definition.details.length > 0 &&
          (readOnly ? (
            <dl className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
              {definition.details.map((d) => (
                <div key={d.key}>
                  <dt>{DETAIL_FIELDS[d.key]}</dt>
                  <dd>{answers.details?.[d.key] || <span className="muted">—</span>}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="form-grid" style={{ marginTop: 'var(--space-5)' }}>
              {definition.details.map((d) => {
                const err = problems?.get(`details.${d.key}`)
                const id = `detail-${d.key}`
                return (
                  <div className="field" key={d.key} id={`field-details-${d.key}`}>
                    <label className="field-label" htmlFor={id}>
                      {DETAIL_FIELDS[d.key]}
                      {!d.required && <span className="optional"> (optional)</span>}
                    </label>
                    <input
                      id={id}
                      className="input"
                      type={d.key === 'date' ? 'date' : 'text'}
                      inputMode={d.key === 'mileage' ? 'decimal' : undefined}
                      maxLength={200}
                      value={answers.details?.[d.key] ?? ''}
                      aria-invalid={err ? 'true' : undefined}
                      onChange={(e) => setDetail(d.key, e.target.value)}
                    />
                    <FieldError message={err} />
                  </div>
                )
              })}
            </div>
          ))}
      </div>
    </section>
  )
}

export function ChecklistSections({ definition, answers, onChange, readOnly, problems }) {
  return definition.sections.map((section) => {
    const items = allItems({ sections: [section] }).filter(({ item }) => item.status)
    const done = items.filter(({ item }) => answers.items?.[item.key]?.status).length
    return (
      <section key={section.key} className="card cl-section" aria-labelledby={`sec-${section.key}`}>
        <div className="card-head">
          <div>
            <h2 id={`sec-${section.key}`}>
              {section.number && <span className="cl-section-num">{section.number}</span>} {section.title || <span className="muted">(untitled section)</span>}
            </h2>
          </div>
          {items.length > 0 && (
            <span className={`badge plain num${done === items.length ? ' success' : ''}`}>
              {done} / {items.length}
            </span>
          )}
        </div>
        <ol className="cl-items">
          {section.items.map((item) => (
            <ItemRow key={item.key} item={item} parent={null} definition={definition} answers={answers} onChange={onChange} readOnly={readOnly} problems={problems} />
          ))}
        </ol>
      </section>
    )
  })
}

export function FooterFields({ definition, answers, onChange, readOnly }) {
  const { remarks, nextServicing } = definition.footer
  if (!remarks && !nextServicing) return null
  return (
    <section className="card" aria-labelledby="footer-title">
      <div className="card-head">
        <div>
          <h2 id="footer-title">{remarks ? 'Remarks / Comments' : 'Next Servicing'}</h2>
        </div>
      </div>
      <div className="card-body form-stack">
        {remarks &&
          (readOnly ? (
            <p className="prewrap">{answers.remarks || <span className="muted">No remarks or comments.</span>}</p>
          ) : (
            <div className="field">
              <label className="visually-hidden" htmlFor="general-remarks">
                Remarks / Comments
              </label>
              <textarea
                id="general-remarks"
                className="textarea"
                rows={3}
                maxLength={4000}
                value={answers.remarks ?? ''}
                onChange={(e) => onChange({ ...answers, remarks: e.target.value })}
              />
            </div>
          ))}
        {nextServicing &&
          (readOnly ? (
            <div>
              <h3 className="mini-heading">Next Servicing</h3>
              <p className="prewrap">{answers.nextServicing || <span className="muted">—</span>}</p>
            </div>
          ) : (
            <div className="field">
              <label className="field-label" htmlFor="next-servicing">
                Next Servicing <span className="optional">(optional)</span>
              </label>
              <textarea
                id="next-servicing"
                className="textarea"
                rows={2}
                maxLength={4000}
                value={answers.nextServicing ?? ''}
                onChange={(e) => onChange({ ...answers, nextServicing: e.target.value })}
              />
            </div>
          ))}
      </div>
    </section>
  )
}

export function DamageAssessment({ definition, answers, onChange, readOnly, problems, diagramUrl, vehicleType }) {
  const extentName = useId()
  if (!definition.damage?.enabled) return null
  const damage = answers.damage ?? { extent: null, notes: '', markers: [] }
  const setDamage = (patch) => onChange({ ...answers, damage: { ...damage, ...patch } })
  const extentError = problems?.get('damage.extent')
  return (
    <section className="card" aria-labelledby="damage-title">
      <div className="card-head">
        <div>
          <h2 id="damage-title">Damage assessment</h2>
          {definition.damage.note && <p>Note: {definition.damage.note}</p>}
        </div>
        <span className="badge plain num">
          {damage.markers.length} marker{damage.markers.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="card-body form-stack">
        {definition.damage.diagramId && diagramUrl ? (
          <DamageDiagram
            src={diagramUrl}
            alt={`${vehicleType ?? 'Vehicle'} damage diagram`}
            markers={damage.markers}
            readOnly={readOnly}
            onChange={(markers) => setDamage({ markers })}
          />
        ) : (
          <p className="muted">No diagram is configured for this checklist.</p>
        )}
        <fieldset className={`extent${extentError ? ' invalid' : ''}`} id="field-damage-extent">
          <legend className="field-label">Extent of damage</legend>
          {readOnly ? (
            <p>{damage.extent ?? <span className="muted">Not answered</span>}</p>
          ) : (
            <div className="extent-options">
              {(definition.damage.extentOptions ?? EXTENT_OPTIONS).map((option) => (
                <label key={option} className="check">
                  <input type="radio" name={extentName} checked={damage.extent === option} onChange={() => setDamage({ extent: option })} /> {option}
                </label>
              ))}
            </div>
          )}
          <FieldError message={extentError} />
        </fieldset>
        {readOnly ? (
          <div>
            <h3 className="mini-heading">Notes / Remarks</h3>
            <p className="prewrap">{damage.notes || <span className="muted">—</span>}</p>
          </div>
        ) : (
          <div className="field">
            <label className="field-label" htmlFor="damage-notes">
              Notes / Remarks <span className="optional">(optional)</span>
            </label>
            <textarea id="damage-notes" className="textarea" rows={2} maxLength={4000} value={damage.notes ?? ''} onChange={(e) => setDamage({ notes: e.target.value })} />
          </div>
        )}
      </div>
    </section>
  )
}

/** The whole form in screen order. `problems` is a Map of field → message. */
export function ChecklistForm({ definition, answers, onChange, readOnly, problems, vehicle, diagramUrl }) {
  return (
    <div className="cl-form">
      {(definition.header?.companyName || definition.statusLegend.length > 0) && (
        <section className="card doc-card">
          <div className="card-body">
            <DocumentHeader header={definition.header} compact />
            <StatusLegend legend={definition.statusLegend} />
          </div>
        </section>
      )}
      <VehicleDetails definition={definition} answers={answers} vehicle={vehicle} onChange={onChange} readOnly={readOnly} problems={problems} />
      <ChecklistSections definition={definition} answers={answers} onChange={onChange} readOnly={readOnly} problems={problems} />
      <FooterFields definition={definition} answers={answers} onChange={onChange} readOnly={readOnly} />
      <DamageAssessment
        definition={definition}
        answers={answers}
        onChange={onChange}
        readOnly={readOnly}
        problems={problems}
        diagramUrl={diagramUrl}
        vehicleType={vehicle?.type}
      />
    </div>
  )
}
