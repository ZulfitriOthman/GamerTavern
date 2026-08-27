import { useId } from "react";

// Shared presentation for every form control — label, id/htmlFor wiring,
// aria-invalid/aria-describedby, hint/error rendering, focus styling. These
// components own accessibility and presentation only; validation rules and
// submit logic stay with the page/feature that uses them.
const CONTROL_CLASSES =
  "w-full rounded-lg border bg-ink-900 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-50/30 transition-colors duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-50";

function borderClasses(hasError) {
  return hasError ? "border-danger-500/50" : "border-white/10 focus:border-brand-400";
}

function FieldLabel({ htmlFor, required, children }) {
  return (
    <label htmlFor={htmlFor} className="text-sm text-amber-50/70">
      {children}
      {required ? <span className="text-danger-400"> *</span> : null}
    </label>
  );
}

function FieldMessage({ id, error, hint }) {
  if (error) {
    return (
      <span id={id} role="alert" className="text-xs text-danger-400">
        {error}
      </span>
    );
  }
  if (hint) {
    return (
      <span id={id} className="text-xs text-amber-50/45">
        {hint}
      </span>
    );
  }
  return null;
}

export function TextField({ id, label, hint, error, required, className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <input
        id={fieldId}
        className={[CONTROL_CLASSES, borderClasses(Boolean(error)), className].join(" ")}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
        required={required}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function TextareaField({ id, label, hint, error, required, className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={fieldId}
        className={[CONTROL_CLASSES, borderClasses(Boolean(error)), className].join(" ")}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
        required={required}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({ id, label, hint, error, required, className = "", children, ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          id={fieldId}
          className={[CONTROL_CLASSES, borderClasses(Boolean(error)), "appearance-none pr-9", className].join(" ")}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={messageId}
          required={required}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-50/40"
        >
          <path
            d="M5 7.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}
