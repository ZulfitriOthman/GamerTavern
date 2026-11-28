import { formatDay } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { journeySteps } from './journey.js'

const STATE_TEXT = { done: 'done', now: 'in progress', yours: 'your turn', next: 'not reached', approved: 'done' }

/** Five-step progress of one inspection, from the viewer's side (see journey.js). */
export function JourneyStrip({ inspection, viewer }) {
  const steps = journeySteps(inspection, viewer, (value) => formatDay(value, ''))
  return (
    <section className="card proto-journey-card" aria-label="Inspection progress">
      <ol className="proto-journey">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className={`is-${step.state}${i > 0 && ['done', 'approved'].includes(steps[i - 1].state) ? ' after-done' : ''}`}
            aria-current={step.state === 'yours' || step.state === 'now' ? 'step' : undefined}
          >
            <span className="proto-journey-dot" aria-hidden="true">
              {step.state === 'done' || step.state === 'approved' ? <Icon name="check" /> : i + 1}
            </span>
            <span className="proto-journey-text">
              <span className="proto-journey-label">
                {step.label}
                <span className="visually-hidden"> ({STATE_TEXT[step.state]})</span>
              </span>
              <span className="proto-journey-sub">{step.sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
