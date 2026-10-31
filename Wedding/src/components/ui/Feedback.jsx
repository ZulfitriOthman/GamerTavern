import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react'

const TONES = {
  info: { Icon: Info, cls: 'border-sand bg-cream/70 text-ink' },
  success: { Icon: CheckCircle2, cls: 'border-sage bg-sage-soft/70 text-sage-deep' },
  error: { Icon: AlertCircle, cls: 'border-rose/40 bg-rose/5 text-rose' },
  warning: { Icon: AlertCircle, cls: 'border-gold/50 bg-champagne/40 text-gold-deep' },
}

export function Notice({ tone = 'info', title, children, className = '' }) {
  const { Icon, cls } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border px-4 py-3 text-base ${cls} ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function Spinner({ className = 'size-5', label = 'Loading' }) {
  return <LoaderCircle className={`animate-spin text-gold ${className}`} aria-label={label} role="status" />
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner className="size-7" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="size-8 text-gold" strokeWidth={1.25} aria-hidden="true" />}
      <p className="mt-4 font-serif text-2xl">{title}</p>
      {children && <div className="mt-2 text-base text-muted">{children}</div>}
    </div>
  )
}

/** Shown wherever a feature needs the wedding API but it could not be reached. */
export function NotConnectedNotice({ feature = 'This feature' }) {
  return (
    <Notice tone="warning" title="Not available yet">
      {feature} needs the website&apos;s server, which could not be reached. Nothing you enter here can be saved right now — please try again later.
    </Notice>
  )
}
