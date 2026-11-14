import { useId, useState } from 'react'
import { Icon } from './Icon.jsx'

// Password field with a Show/Hide toggle, label, optional hint and inline error.
// Uncontrolled by default (read it with FormData); extra props go to the <input>.
export function PasswordInput({ label, name, autoComplete = 'new-password', hint, error, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="input-group">
        <input
          id={id}
          className="input"
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? 'true' : undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm input-addon"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId}>
          <Icon name="alert" /> {error}
        </span>
      )}
    </div>
  )
}
