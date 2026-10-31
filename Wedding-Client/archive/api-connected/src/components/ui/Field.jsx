import { useId } from 'react'

/** Labelled input / textarea / select with hint, counter and accessible error. */
export function Field({ label, hint, error, as = 'input', counter, className = '', children, ...props }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const Tag = as
  const length = counter && typeof props.value === 'string' ? props.value.length : null
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {props.required && <span className="text-gold-deep" aria-hidden="true"> *</span>}
        </label>
      )}
      <Tag id={id} className={`input ${as === 'textarea' ? 'min-h-28 resize-y' : ''}`} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Tag>
      <div className="mt-1.5 flex justify-between gap-3 text-xs">
        <span>
          {error ? (
            <span id={`${id}-error`} className="text-rose" role="alert">
              {error}
            </span>
          ) : (
            hint && (
              <span id={`${id}-hint`} className="text-muted">
                {hint}
              </span>
            )
          )}
        </span>
        {length !== null && props.maxLength && (
          <span className={`tabular-nums ${length > props.maxLength * 0.9 ? 'text-gold-deep' : 'text-muted/70'}`}>
            {length}/{props.maxLength}
          </span>
        )}
      </div>
    </div>
  )
}

export function Checkbox({ label, description, className = '', ...props }) {
  const id = useId()
  return (
    <div className={`flex gap-3 ${className}`}>
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 cursor-pointer rounded accent-gold-deep" {...props} />
      <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-ink">
        {label}
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
    </div>
  )
}

/** Switch-style toggle (a checkbox with role=switch). */
export function Toggle({ label, description, checked, onChange, disabled }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="cursor-pointer text-sm text-ink">
        {label}
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-sage-deep' : 'bg-champagne'} disabled:opacity-50`}
      >
        <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

/** Hidden field bots fill in; the API silently discards those submissions. */
export function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}
