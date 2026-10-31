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
          {props.required && <span className="text-primary" aria-hidden="true"> *</span>}
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
          <span className={`tabular-nums ${length > props.maxLength * 0.9 ? 'text-primary' : 'text-muted/70'}`}>
            {length}/{props.maxLength}
          </span>
        )}
      </div>
    </div>
  )
}
