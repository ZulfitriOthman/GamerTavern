// Shared presentational components for the admin site and vendor portal.
// Pattern references (re-implemented here in plain React + CSS, no code copied):
//   21st.dev shadcn/alert-dialog → Modal / ConfirmDialog (title, consequence, Cancel/confirm)
import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon.jsx'

export function Brand({ sub, to }) {
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true">
        M
      </span>
      <span className="brand-text">
        <span className="brand-name">Mashoor</span>
        {sub && <span className="brand-sub">{sub}</span>}
      </span>
    </>
  )
  return to ? (
    <Link className="brand" to={to} aria-label={sub ? `Mashoor ${sub} home` : 'Mashoor home'}>
      {content}
    </Link>
  ) : (
    <span className="brand">{content}</span>
  )
}

export function Avatar({ name }) {
  // First letter/digit of the first two words that have one ("Alice (Vendor A)" → "AV").
  const initials = String(name ?? '')
    .split(/\s+/)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="avatar" aria-hidden="true">
      {initials || '·'}
    </span>
  )
}

export function PageHeader({ title, description, actions, back, badge }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link className="back-link" to={back.to}>
            <Icon name="back" /> {back.label}
          </Link>
        )}
        <h1>
          {title} {badge}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function EmptyState({ icon = 'inbox', title, children, actions, tone }) {
  return (
    <div className={`state${tone === 'error' ? ' error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="state-icon">
        <Icon name={tone === 'error' ? 'alert' : icon} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

const ALERT_ICONS = { success: 'check', danger: 'alert', warning: 'alert', info: 'info' }

// tone: success | danger | warning | info. Errors are announced assertively.
export function Alert({ tone = 'info', title, children, onDismiss }) {
  return (
    <div className={`alert ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={ALERT_ICONS[tone]} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon alert-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="close" />
        </button>
      )}
    </div>
  )
}

// Wires one form control to its label, hint and inline error via id /
// aria-describedby / aria-invalid. The child must be a single control element.
// `prefix` renders a short unit (e.g. "RM") inside the start of the control.
export function Field({ label, hint, error, optional, prefix, children, className = '' }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const child = Children.only(children)
  const control = isValidElement(child)
    ? cloneElement(child, {
        id: child.props.id ?? id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
      })
    : child
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field-label" htmlFor={child.props?.id ?? id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {prefix ? (
        <span className="input-prefix">
          <span aria-hidden="true">{prefix}</span>
          {control}
        </span>
      ) : (
        control
      )}
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

// Native <dialog> modal: focus is moved inside and trapped by the browser,
// Escape closes it, focus returns to the opener. Content mounts only while open
// so forms start fresh each time.
export function Modal({ open, onClose, title, description, wide, children }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Focus the marked control, else the first field, else the browser default.
      const target =
        dialog.querySelector('[data-autofocus]') ??
        dialog.querySelector('.dialog-body input:not([type=hidden]), .dialog-body select, .dialog-body textarea')
      target?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' wide' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => open && onClose()}
      onMouseDown={(event) => {
        // A press on the backdrop (the dialog element itself) closes it.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <>
          <div className="dialog-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p id={descId}>{description}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}

// Confirmation for consequential actions (replaces window.confirm).
export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'danger', busy, error, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} description={description}>
      {error && (
        <div className="dialog-body">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <div className="dialog-foot">
        <button type="button" className="btn" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function Pagination({ pagination, onPage, noun = 'items' }) {
  if (!pagination || pagination.total === 0) return null
  const { page, limit, total, pages } = pagination
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="num">
        Showing {first}–{last} of {total} {noun}
      </span>
      {pages > 1 && (
        <div className="pagination-controls">
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <Icon name="back" /> Previous
          </button>
          <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next <Icon name="next" />
          </button>
        </div>
      )}
    </nav>
  )
}
