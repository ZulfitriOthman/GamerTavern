import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const TONES = {
  info: { icon: Info, cls: 'border-blush bg-mist/80 text-ink' },
  success: { icon: CheckCircle2, cls: 'border-leaf/50 bg-leaf-soft/60 text-leaf-deep' },
  error: { icon: AlertCircle, cls: 'border-rose/30 bg-rose/8 text-rose' },
}

export function Notice({ tone = 'info', title, children, className = '' }) {
  const { icon: Icon, cls } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  )
}
