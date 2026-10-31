import { ArrowDown, ArrowUp, Check, Copy, Download, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useId, useRef, useState } from 'react'
import { mediaUrl } from '../../lib/api.js'
import { IMAGE_ACCEPT } from '../../lib/validation.js'
import { uploadSiteImage } from '../../services/adminService.js'
import { Notice, ProgressBar } from '../../components/ui/Feedback.jsx'
import { useAction } from '../auth.jsx'
import { copyText } from '../lib.js'

export function PageTitle({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Pill-style tabs; `counts` optional. */
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-none -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
            value === t.value ? 'border-ink bg-ink text-ivory' : 'border-champagne bg-white/70 text-muted hover:border-gold hover:text-ink'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

const PILL = {
  approved: 'bg-sage-soft text-sage-deep',
  pending: 'bg-champagne/60 text-gold-deep',
  rejected: 'bg-linen text-muted',
  hidden: 'bg-linen text-muted',
  spam: 'bg-rose/10 text-rose',
  yes: 'bg-sage-soft text-sage-deep',
  no: 'bg-rose/10 text-rose',
}
const PILL_LABEL = { approved: 'Visible', rejected: 'Hidden', hidden: 'Hidden', pending: 'Pending', spam: 'Spam' }

export function StatusPill({ status, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[status] ?? 'bg-linen text-muted'}`}>
      {children ?? PILL_LABEL[status] ?? status}
    </span>
  )
}

/** Success / error line for an action. */
export function ActionStatus({ error, notice, className = 'mb-4' }) {
  if (!error && !notice) return null
  return (
    <Notice tone={error ? 'error' : 'success'} className={className}>
      {error || notice}
    </Notice>
  )
}

export function CopyButton({ text, label = 'Copy', className = 'btn-outline !min-h-9 !px-3 !py-1.5 text-xs' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }
      }}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/** Renders a QR code for `value`, with an optional PNG download. */
export function QrCode({ value, size = 180, filename, className = '' }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { width: 720, margin: 2, color: { dark: '#3b3630', light: '#ffffff' } }).then(
      (url) => alive && setSrc(url),
      () => alive && setSrc(''),
    )
    return () => {
      alive = false
    }
  }, [value])
  if (!src) return <div className={`skeleton ${className}`} style={{ width: size, height: size }} />
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img src={src} width={size} height={size} alt={`QR code for ${value}`} className="rounded-xl border border-champagne bg-white p-1" />
      {filename && (
        <a href={src} download={filename} className="btn-ghost !min-h-9 !py-1 text-xs">
          <Download className="size-3.5" aria-hidden="true" /> Download PNG
        </a>
      )}
    </div>
  )
}

/**
 * Editor for arrays of small objects (programme, FAQ, timeline, contacts…).
 * fields: [{ key, label, type?: 'text'|'textarea'|'time'|'tel'|'email'|'image', placeholder?, wide?, rows? }]
 */
export function ListEditor({ items, onChange, fields, emptyItem, addLabel = 'Add', max = 30 }) {
  const list = Array.isArray(items) ? items : []
  const update = (i, key, value) => onChange(list.map((item, j) => (j === i ? { ...item, [key]: value } : item)))
  const move = (i, d) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="rounded-2xl border border-champagne bg-white/60 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <ListField key={f.key} field={f} value={item?.[f.key] ?? ''} onChange={(v) => update(i, f.key, v)} />
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-1">
            <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)} icon={ArrowUp} />
            <IconBtn label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)} icon={ArrowDown} />
            <IconBtn label="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))} icon={Trash2} danger />
          </div>
        </div>
      ))}
      {list.length < max && (
        <button type="button" className="btn-outline !min-h-9 !py-1.5 text-xs" onClick={() => onChange([...list, { ...emptyItem }])}>
          <Plus className="size-3.5" aria-hidden="true" /> {addLabel}
        </button>
      )}
    </div>
  )
}

function ListField({ field, value, onChange }) {
  const id = useId()
  const wide = field.wide || field.type === 'textarea' || field.type === 'image'
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="field-label">
        {field.label}
      </label>
      {field.type === 'image' ? (
        <ImageField id={id} value={value} onChange={onChange} />
      ) : field.type === 'textarea' ? (
        <textarea id={id} className="input min-h-20" rows={field.rows ?? 3} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" type={field.type ?? 'text'} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

export function IconBtn({ label, icon: Icon, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-full p-2 transition disabled:opacity-30 ${danger ? 'text-rose hover:bg-rose/10' : 'text-muted hover:bg-cream hover:text-ink'}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

/** Image picker for hero / story pictures. Uploads immediately and stores the returned URL. */
export function ImageField({ id, value, onChange }) {
  const input = useRef(null)
  const [progress, setProgress] = useState(null)
  const { busy, error, run } = useAction()
  const pick = async (file) => {
    if (!file) return
    setProgress(0)
    const result = await run(() => uploadSiteImage(file, setProgress))
    setProgress(null)
    if (result?.url) onChange(result.url)
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={mediaUrl(value)} alt="" className="h-20 w-28 rounded-xl border border-champagne object-cover" />
        ) : (
          <div className="grid h-20 w-28 place-items-center rounded-xl border border-dashed border-sand bg-cream/50 text-muted">
            <ImagePlus className="size-5" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button id={id} type="button" className="btn-outline !min-h-9 !py-1.5 text-xs" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus className="size-3.5" aria-hidden="true" /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
          </button>
          {value && !busy && (
            <button type="button" className="btn-ghost !min-h-9 !py-1.5 text-xs" onClick={() => onChange('')}>
              <X className="size-3.5" aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            pick(file)
          }}
        />
      </div>
      {progress !== null && <ProgressBar value={progress} label="Uploading image" />}
      {error && <p className="mt-1.5 text-xs text-rose" role="alert">{error}</p>}
    </div>
  )
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  )
}
