import { CheckCircle2, Film, ImagePlus, LoaderCircle, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CharCount, Field, Honeypot } from '../components/ui/Field.jsx'
import { Notice, NotConnectedNotice } from '../components/ui/Feedback.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { friendlyError } from '../lib/errors.js'
import { prepareMedia } from '../lib/mediaUpload.js'
import { checkMediaFile, hasErrors, LIMITS, MEDIA_ACCEPT, mediaKind, validateUploadMeta } from '../lib/validation.js'
import { uploadGuestMedia } from '../services/photoService.js'

let fileSeq = 0

const SUCCESS_MESSAGE =
  'Thank you for sharing your memories! Your photos and videos have been uploaded successfully and are now available in our wedding gallery.'

/**
 * QR-code friendly page where guests share photos, GIFs and videos.
 * Photos are resized in the browser; GIFs and videos are sent as-is (with a
 * poster frame for videos). The API validates every file again and publishes
 * it immediately — there is no approval step.
 */
export function SharePage() {
  const { settings, connected, coupleTitle } = useSite()
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [items, setItems] = useState([]) // { key, file, kind, preview, status, progress, error }
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)
  const previewUrls = useRef(new Set())

  // Release preview object URLs when leaving the page.
  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const update = (key, patch) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const addFiles = (fileList) => {
    const incoming = [...fileList].map((file) => {
      const problem = checkMediaFile(file)
      const preview = URL.createObjectURL(file)
      previewUrls.current.add(preview)
      return { key: ++fileSeq, file, kind: mediaKind(file), preview, status: problem ? 'invalid' : 'ready', progress: 0, error: problem }
    })
    setFinished(false)
    setItems((list) => [...list.filter((i) => i.status !== 'done'), ...incoming].slice(0, LIMITS.maxFilesPerBatch))
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (key) =>
    setItems((list) => {
      const target = list.find((i) => i.key === key)
      if (target) URL.revokeObjectURL(target.preview)
      return list.filter((i) => i.key !== key)
    })

  const queue = items.filter((i) => i.status === 'ready' || i.status === 'failed')
  const succeeded = items.filter((i) => i.status === 'done')
  const failed = items.filter((i) => i.status === 'failed' || i.status === 'invalid')

  const submit = async (e) => {
    e.preventDefault()
    const { errors: errs, values } = validateUploadMeta({ name, caption, consent, files: queue })
    setErrors(errs)
    if (hasErrors(errs) || !connected) return
    setBusy(true)
    setFinished(false)
    for (const item of queue) {
      update(item.key, { status: 'processing', progress: 0, error: null })
      try {
        const prepared = await prepareMedia(item.file)
        if (prepared.kind === 'image' && prepared.blob.size > LIMITS.maxUploadBytes) throw new Error('This photo is still too large after compression.')
        update(item.key, { status: 'uploading' })
        // Resolves only once the server has published the file and it is reachable.
        await uploadGuestMedia(prepared, { ...values, website }, (p) => update(item.key, { progress: p }))
        update(item.key, { status: 'done', progress: 1 })
      } catch (err) {
        update(item.key, { status: 'failed', error: err.userMessage || (err.status ? friendlyError(err) : err.message || friendlyError(err)) })
        if (err.status === 429 || err.status === 403) break
      }
    }
    setBusy(false)
    setFinished(true)
  }

  if (!settings.photo_uploads_enabled) {
    return (
      <PageShell eyebrow="Share your memories" title="Photo Sharing" width="narrow">
        <Notice title="Photo sharing is closed">Thank you for thinking of us! Uploads are not open at the moment.</Notice>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow={coupleTitle}
      title="Share Your Memories"
      width="narrow"
      intro="Took a lovely photo or video during the celebrations? Upload it here so we can treasure it forever."
    >
      {!connected && <NotConnectedNotice feature="Photo sharing" />}

      <Reveal>
        <form onSubmit={submit} noValidate className="card mt-6 space-y-6 p-6 sm:p-10">
          <Honeypot value={website} onChange={setWebsite} />

          {/* Picker */}
          <div>
            <span className="field-label">Your photos &amp; videos</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sand bg-ivory/70 px-6 py-10 text-center transition hover:border-gold hover:bg-champagne/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (!busy) addFiles(e.dataTransfer.files)
              }}
            >
              <ImagePlus className="size-9 text-gold" strokeWidth={1.25} />
              <span className="mt-3 font-serif text-2xl">Tap to choose photos, GIFs or videos</span>
              <span className="mt-1 text-sm text-muted">
                Photos, GIFs, MP4 &amp; WebM videos (up to {Math.round(LIMITS.maxVideoBytes / 1024 / 1024)} MB) · {LIMITS.maxFilesPerBatch} at a time
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={MEDIA_ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose photos, GIFs or videos"
              onChange={(e) => addFiles(e.target.files)}
            />
            {errors.files && <p className="field-error">{errors.files}</p>}

            {items.length > 0 && (
              <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Selected files">
                {items.map((item) => (
                  <li key={item.key} className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
                    {item.kind === 'video' ? (
                      <>
                        <video src={item.preview} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={item.file.name} />
                        <Film className="absolute bottom-1.5 left-1.5 size-5 rounded bg-ink/60 p-0.5 text-ivory" aria-hidden="true" />
                      </>
                    ) : (
                      <img src={item.preview} alt="" className="h-full w-full object-cover" />
                    )}
                    <UploadOverlay item={item} />
                    {!busy && item.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => remove(item.key)}
                        className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-ivory/90 text-ink shadow"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Your name" error={errors.name}>
            {(p) => (
              <input {...p} className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} autoComplete="name" disabled={busy} />
            )}
          </Field>

          <Field label="Caption" optional error={errors.caption}>
            {(p) => (
              <>
                <input {...p} className="field-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={LIMITS.caption} placeholder="e.g. The first dance" disabled={busy} />
                <div className="mt-1 text-right">
                  <CharCount value={caption} max={LIMITS.caption} />
                </div>
              </>
            )}
          </Field>

          {/* Sharing notice + consent */}
          <div className="rounded-2xl border border-champagne bg-cream/60 p-4 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-ink">
              <ShieldCheck className="size-4 text-sage-deep" /> Privacy notice
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              <li>Photos, GIFs, and videos you upload will become visible to visitors of this wedding website immediately after successful upload.</li>
              <li>Your name and caption will be shown alongside what you share.</li>
              <li>Photos are resized on your device and location/camera details are removed before upload.</li>
              <li>Please only upload content you took or have permission to share, and that other guests would be comfortable seeing. You can ask the couple to remove anything at any time.</li>
            </ul>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-ink">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-gold-deep" disabled={busy} />
              <span>I have permission to share these photos and videos, and I agree to them being shown on this wedding website.</span>
            </label>
            {errors.consent && <p className="field-error">{errors.consent}</p>}
          </div>

          <div aria-live="polite" className="space-y-3">
            {finished && !busy && succeeded.length > 0 && failed.length === 0 && (
              <Notice tone="success" title="Uploaded">
                {SUCCESS_MESSAGE}{' '}
                <Link to="/gallery" className="underline">
                  View the gallery
                </Link>
              </Notice>
            )}
            {finished && !busy && failed.length > 0 && (
              <Notice tone={succeeded.length ? 'warning' : 'error'} title={`${succeeded.length} uploaded, ${failed.length} not uploaded`}>
                {succeeded.length > 0 && (
                  <p>
                    {succeeded.length} file{succeeded.length > 1 ? 's are' : ' is'} now in our{' '}
                    <Link to="/gallery" className="underline">
                      wedding gallery
                    </Link>
                    .
                  </p>
                )}
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {failed.map((i) => (
                    <li key={i.key}>
                      <span className="font-medium">{i.file.name}</span>: {i.error}
                    </li>
                  ))}
                </ul>
              </Notice>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy || !connected || queue.length === 0}>
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Uploading…
              </>
            ) : (
              'Upload memories'
            )}
          </button>
        </form>
      </Reveal>
    </PageShell>
  )
}

function UploadOverlay({ item }) {
  if (item.status === 'ready') return null
  const base = 'absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-xs leading-tight font-medium'
  if (item.status === 'done')
    return (
      <div className={`${base} bg-sage-deep/60 text-white`}>
        <CheckCircle2 className="size-7" />
        In the gallery
      </div>
    )
  if (item.status === 'failed' || item.status === 'invalid')
    return (
      <div className={`${base} bg-ink/70 text-white`} title={item.error}>
        <XCircle className="size-6 text-rose" />
        <span className="line-clamp-3">{item.error}</span>
      </div>
    )
  return (
    <div className={`${base} bg-ink/45 text-white`}>
      <LoaderCircle className="size-6 animate-spin" />
      {item.status === 'processing' ? 'Preparing…' : `${Math.round(item.progress * 100)}%`}
      <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
        <span className="block h-full bg-champagne transition-all" style={{ width: `${Math.round(item.progress * 100)}%` }} />
      </span>
    </div>
  )
}
