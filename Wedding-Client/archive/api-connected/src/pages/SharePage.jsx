// "Share your memories" — designed to be opened from a QR code at the venue.
// Files upload one at a time with progress; each result reflects what the
// API actually reported for that file.
import { Camera, CheckCircle2, ImagePlus, Loader2, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox, Field, Honeypot } from '../components/ui/Field.jsx'
import { Notice, ProgressBar } from '../components/ui/Feedback.jsx'
import { Ornament } from '../components/ui/Section.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { errorMessage } from '../lib/api.js'
import { siteTitle } from '../lib/content.js'
import { checkMediaFile, clean, LIMITS, MEDIA_ACCEPT, mediaKind } from '../lib/validation.js'
import { shareMedia } from '../services/publicService.js'

let nextId = 0

export default function SharePage() {
  const { ready, status, settings, content, events } = useSite()
  const [items, setItems] = useState([]) // { id, file, preview, kind, state: queued|working|done|error, progress, message, published }
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Release preview URLs when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), [])

  const update = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const addFiles = (fileList) => {
    const files = Array.from(fileList ?? [])
    const room = LIMITS.filesPerBatch - items.filter((i) => i.state !== 'done').length
    const added = files.slice(0, Math.max(0, room)).map((file) => {
      const problem = checkMediaFile(file)
      const kind = mediaKind(file)
      return {
        id: ++nextId,
        file,
        kind,
        preview: !problem && kind !== 'video' && !/hei[cf]$/i.test(file.name) ? URL.createObjectURL(file) : null,
        state: problem ? 'error' : 'queued',
        progress: 0,
        message: problem,
        rejected: Boolean(problem),
      }
    })
    setItems((list) => [...list, ...added])
    if (files.length > added.length) setErrors((e) => ({ ...e, files: `You can share up to ${LIMITS.filesPerBatch} files at a time.` }))
    else setErrors((e) => ({ ...e, files: undefined }))
  }

  const remove = (id) =>
    setItems((list) => {
      const item = list.find((i) => i.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return list.filter((i) => i.id !== id)
    })

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const queue = items.filter((i) => i.state === 'queued' || (i.state === 'error' && !i.rejected))
    const found = {}
    if (!clean(name)) found.name = 'Please enter your name.'
    if (!queue.length) found.files = 'Please choose at least one photo or video.'
    if (!consent) found.consent = 'Please confirm the sharing notice.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    for (const item of queue) {
      update(item.id, { state: 'working', progress: 0, message: '' })
      try {
        const result = await shareMedia(item.file, { name, caption, website }, (p) => update(item.id, { progress: p }))
        update(item.id, { state: 'done', progress: 1, published: result.status === 'published' })
      } catch (error) {
        update(item.id, { state: 'error', message: errorMessage(error, 'This file could not be uploaded.') })
        if (error.status === 429 || error.status === 403 || error.status === 507) break // further files would fail the same way
      }
    }
    setBusy(false)
  }

  const done = items.filter((i) => i.state === 'done')
  const pending = items.filter((i) => i.state !== 'done')
  const names = siteTitle(content, events)
  const closed = ready && !settings.photo_uploads_enabled

  return (
    <section className="px-4 pt-24 pb-10 sm:pt-32">
      <Reveal className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-gold/50 bg-white/70 text-gold-deep shadow-soft">
          <Camera className="size-7" strokeWidth={1.3} aria-hidden="true" />
        </span>
        <p className="eyebrow mt-6">{names}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Share your memories</h1>
        <Ornament className="mt-5" />
        <p className="mt-5 leading-relaxed text-muted text-balance">Captured a beautiful moment? Add your photos and short videos to our wedding album.</p>
      </Reveal>

      <div className="paper mx-auto mt-10 max-w-xl p-5 sm:p-8">
        {status === 'loading' ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : !ready ? (
          <Notice tone="error" title="Uploads are unavailable">
            The website could not reach its server, so photos can't be shared right now. Please try again shortly.
          </Notice>
        ) : closed ? (
          <Notice title="Photo sharing is closed">Thank you to everyone who shared their memories.</Notice>
        ) : (
          <form onSubmit={submit} noValidate className="relative space-y-6">
            <Honeypot value={website} onChange={setWebsite} />

            <div>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-sand bg-cream/50 px-6 py-10 text-center transition hover:border-gold hover:bg-cream disabled:opacity-60"
                aria-describedby="file-help"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!busy) addFiles(e.dataTransfer.files)
                }}
              >
                <ImagePlus className="size-9 text-gold transition group-hover:scale-110" strokeWidth={1.3} aria-hidden="true" />
                <span className="font-serif text-xl text-ink">Choose photos or videos</span>
                <span id="file-help" className="text-xs text-muted">
                  JPEG, PNG, HEIC, WebP, GIF, MP4 or WebM · up to {LIMITS.filesPerBatch} at a time
                </span>
              </button>
              <input
                ref={input}
                type="file"
                accept={MEDIA_ACCEPT}
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              {errors.files && (
                <p className="mt-2 text-xs text-rose" role="alert">
                  {errors.files}
                </p>
              )}
            </div>

            {pending.length > 0 && (
              <ul className="space-y-2.5" aria-label="Selected files">
                {pending.map((item) => (
                  <FileRow key={item.id} item={item} onRemove={busy ? null : () => remove(item.id)} />
                ))}
              </ul>
            )}

            <Field label="Your name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} error={errors.name} disabled={busy} />
            <Field
              as="textarea"
              rows={2}
              label="Caption (optional)"
              placeholder="A few words about this moment"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={LIMITS.caption}
              counter
              disabled={busy}
            />

            <div className="rounded-2xl border border-champagne bg-ivory p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldCheck className="size-4 text-sage-deep" aria-hidden="true" /> Before you share
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
                <li>Your photos and videos, name and caption will be shown in the wedding gallery on this website.</li>
                <li>Location data (GPS) is removed from photos before they are stored.</li>
                <li>The couple can hide or remove any upload at any time — just ask them if you'd like something taken down.</li>
                <li>Please only share photos you took yourself and that guests would be happy to have shown.</li>
              </ul>
              <Checkbox
                className="mt-4"
                label="I took these photos and agree to them being shown in the wedding gallery."
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked)
                  setErrors((er) => ({ ...er, consent: undefined }))
                }}
                disabled={busy}
              />
              {errors.consent && (
                <p className="mt-2 text-xs text-rose" role="alert">
                  {errors.consent}
                </p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
                </>
              ) : (
                <>Share {pending.filter((i) => !i.rejected).length > 1 ? `${pending.filter((i) => !i.rejected).length} files` : 'memories'}</>
              )}
            </button>
          </form>
        )}

        {done.length > 0 && (
          <div className="mt-6" aria-live="polite">
            <Notice
              tone="success"
              title={`Thank you! ${done.length} ${done.length === 1 ? 'memory' : 'memories'} shared.`}
              action={
                done.some((i) => i.published) && (
                  <Link to="/gallery" className="font-medium underline underline-offset-4">
                    See the gallery
                  </Link>
                )
              }
            >
              {done.every((i) => i.published) ? 'They are now in the wedding gallery.' : 'They will appear in the gallery once the couple has reviewed them.'}
            </Notice>
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {done.map((i) => (
                <li key={i.id} className="relative aspect-square overflow-hidden rounded-xl bg-linen">
                  {i.preview ? <img src={i.preview} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs text-muted">{i.kind}</span>}
                  <CheckCircle2 className="absolute right-1 bottom-1 size-5 rounded-full bg-white text-sage-deep" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function FileRow({ item, onRemove }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-champagne/80 bg-white/70 p-2.5">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-linen text-[0.6rem] tracking-wider text-muted uppercase">
        {item.preview ? <img src={item.preview} alt="" className="size-full object-cover" /> : item.kind || 'file'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{item.file.name}</p>
        {item.state === 'working' ? (
          <div className="mt-2">
            <ProgressBar value={item.progress} label={`Uploading ${item.file.name}`} />
            <p className="mt-1 text-[0.7rem] text-muted">{item.progress < 1 ? `Uploading ${Math.round(item.progress * 100)}%` : 'Saving…'}</p>
          </div>
        ) : item.state === 'error' ? (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-rose">
            {item.rejected ? <TriangleAlert className="mt-px size-3.5 shrink-0" /> : <RotateCcw className="mt-px size-3.5 shrink-0" />}
            {item.message}
            {!item.rejected && ' Press Share to retry.'}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">{(item.file.size / 1024 / 1024).toFixed(1)} MB · ready</p>
        )}
      </div>
      {onRemove && item.state !== 'working' && (
        <button type="button" onClick={onRemove} className="rounded-full p-2 text-muted hover:bg-cream hover:text-rose" aria-label={`Remove ${item.file.name}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  )
}
