import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Notice } from '../../components/ui/Feedback.jsx'
import { friendlyError } from '../../lib/errors.js'
import { prepareImage } from '../../lib/image.js'
import { checkImageFile } from '../../lib/validation.js'
import { mediaUrl } from '../../lib/api.js'
import { uploadSiteAsset } from '../../services/adminService.js'

/** Wraps an async admin action with busy + error/success feedback. */
// eslint-disable-next-line react/only-export-components
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null) // { tone, message }

  const run = useCallback(async (fn, successMessage) => {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await fn()
      if (successMessage) setFeedback({ tone: 'success', message: successMessage })
      return result
    } catch (err) {
      console.error(err)
      setFeedback({ tone: 'error', message: friendlyError(err, err?.message || 'The action failed.') })
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  const node = feedback ? (
    <Notice tone={feedback.tone} className="mb-4">
      {feedback.message}
    </Notice>
  ) : null
  return { busy, run, feedback: node, clear: () => setFeedback(null) }
}

export function StatCard({ label, value, hint, accent = false }) {
  return (
    <div className={`rounded-3xl border p-5 ${accent ? 'border-gold/50 bg-champagne/40' : 'border-champagne bg-white/70'}`}>
      <p className="text-[0.65rem] tracking-[0.2em] text-muted uppercase">{label}</p>
      <p className="mt-2 font-serif text-4xl text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`chip shrink-0 ${value === o.value ? 'chip-active' : ''}`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-2 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Generic editor for arrays of small objects (FAQ, timeline, programme…).
 * fields: [{ key, label, type?: 'text'|'textarea'|'time'|'image', placeholder? }]
 */
export function ListEditor({ items, onChange, fields, addLabel = 'Add item', emptyItem, max = 50 }) {
  const list = Array.isArray(items) ? items : []
  const set = (i, key, value) => onChange(list.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)))
  const move = (i, d) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="rounded-2xl border border-champagne bg-white/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const Wrapper = f.type === 'image' ? 'div' : 'label'
              return (
              <Wrapper key={f.key} className={f.type === 'textarea' || f.wide ? 'sm:col-span-2' : ''}>
                <span className="field-label">{f.label}</span>
                {f.type === 'textarea' ? (
                  <textarea rows={f.rows ?? 3} className="field-input" value={item[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} />
                ) : f.type === 'image' ? (
                  <ImageField value={item[f.key] ?? ''} onChange={(v) => set(i, f.key, v)} />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    className="field-input"
                    value={item[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => set(i, f.key, e.target.value)}
                  />
                )}
              </Wrapper>
              )
            })}
          </div>
          <div className="mt-3 flex justify-end gap-1">
            <button type="button" className="btn-ghost btn-sm px-3" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" className="btn-ghost btn-sm px-3" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              <ArrowDown className="size-4" />
            </button>
            <button type="button" className="btn-ghost btn-sm px-3 text-rose" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label="Remove">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      {list.length < max && (
        <button type="button" className="btn-outline btn-sm" onClick={() => onChange([...list, { ...emptyItem }])}>
          <Plus className="size-4" /> {addLabel}
        </button>
      )}
    </div>
  )
}

/** Image picker that resizes and uploads to the public site-assets bucket, returning a URL. */
export function ImageField({ value, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (file) => {
    if (!file) return
    const problem = checkImageFile(file)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const { full } = await prepareImage(file)
      onChange(await uploadSiteAsset(full.blob))
    } catch (err) {
      setError(friendlyError(err, err.message))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-champagne bg-cream">
          {value && <img src={mediaUrl(value)} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {value ? 'Replace' : 'Upload'}
          </button>
          {value && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-champagne bg-white/60 px-4 py-3">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-sand transition peer-checked:bg-sage-deep peer-focus-visible:ring-2 peer-focus-visible:ring-gold after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  )
}
