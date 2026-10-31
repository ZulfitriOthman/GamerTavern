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

function FieldLabel({ htmlFor, required, labelExtra, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm text-amber-50/70">
        {children}
        {required ? <span className="text-danger-400"> *</span> : null}
      </label>
      {labelExtra}
    </span>
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

export function TextField({ id, label, labelExtra, hint, error, required, className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={fieldId} required={required} labelExtra={labelExtra}>
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

// Native input + Tailwind's accent-color utility rather than a fully custom
// checkbox (fake box + visually-hidden input) — native gets keyboard/AT
// behavior, indeterminate state, and OS-level styling for free, and
// accent-brand-500 is enough to keep it on-brand without reimplementing a
// widget the platform already provides correctly.
export function CheckboxField({ id, label, hint, error, className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <label htmlFor={fieldId} className="flex items-start gap-2.5 text-sm text-amber-50/80">
        <input
          id={fieldId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-900 accent-brand-500 focus-ring"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={messageId}
          {...props}
        />
        {label}
      </label>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

// `options`: [{ value, label }]. Renders as a native radiogroup (fieldset/
// legend) so screen readers announce it as one control, not N unrelated
// radios — same accent-color approach as CheckboxField above.
export function RadioGroupField({ name, label, options, value, onChange, hint, error, required, className = "" }) {
  const messageId = error || hint ? `${name}-message` : undefined;

  return (
    <fieldset className={["flex flex-col gap-2", className].join(" ")}>
      {label ? (
        <legend className="text-sm text-amber-50/70">
          {label}
          {required ? <span className="text-danger-400"> *</span> : null}
        </legend>
      ) : null}
      <div className="flex flex-col gap-2" aria-describedby={messageId}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2.5 text-sm text-amber-50/80">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 shrink-0 border-white/20 bg-ink-900 accent-brand-500 focus-ring"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </fieldset>
  );
}

// A styled label wraps the (visually-hidden but still focusable/keyboard-
// operable) native file input, matching TextField's control chrome. Shows
// the selected filename(s) rather than the browser's own unstyleable
// "no file chosen" text.
export function FileUploadField({ id, label, hint, error, required, accept, multiple, onChange, fileNames = [], className = "" }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const messageId = error || hint ? `${fieldId}-message` : undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <label
        htmlFor={fieldId}
        className={[
          CONTROL_CLASSES,
          borderClasses(Boolean(error)),
          "flex cursor-pointer items-center justify-between gap-3",
        ].join(" ")}
      >
        <span className="truncate text-amber-50/70">
          {fileNames.length > 0 ? fileNames.join(", ") : "Choose file" + (multiple ? "s" : "")}
        </span>
        <span className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-amber-50/80">
          Browse
        </span>
      </label>
      <input
        id={fieldId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="sr-only"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
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
