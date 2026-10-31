import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react'

const TONES = {
  info: { icon: Info, cls: 'border-champagne bg-cream/70 text-ink' },
  success: { icon: CheckCircle2, cls: 'border-sage/50 bg-sage-soft/60 text-sage-deep' },
  error: { icon: AlertCircle, cls: 'border-rose/30 bg-rose/8 text-rose' },
}

export function Notice({ tone = 'info', title, children, action, className = '' }) {
  const { icon: Icon, cls } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-muted ${className}`}>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  )
}

export function LoadError({ message, onRetry }) {
  return (
    <Notice
      tone="error"
      title="This couldn't be loaded"
      action={
        onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
            <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
          </button>
        )
      }
    >
      {message}
    </Notice>
  )
}

export function ProgressBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-linen">
      <div className="h-full rounded-full bg-gradient-to-r from-sage to-gold transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card mx-auto max-w-md px-6 py-10 text-center">
      {Icon && <Icon className="mx-auto mb-3 size-8 text-gold" strokeWidth={1.3} aria-hidden="true" />}
      <p className="font-serif text-xl">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}
