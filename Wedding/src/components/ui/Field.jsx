import { useId } from 'react'

/** Label + control + hint/error with correct aria wiring. */
export function Field({ label, hint, error, optional, children, className = '' }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {optional && <span className="ml-1 font-medium tracking-normal text-muted normal-case">(optional)</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

/** Hidden honeypot input. Humans never see or fill it; simple bots do. */
export function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export function CharCount({ value, max }) {
  const n = value?.length ?? 0
  return <span className={`text-xs ${n > max ? 'text-rose' : 'text-muted'}`}>{`${n}/${max}`}</span>
}
