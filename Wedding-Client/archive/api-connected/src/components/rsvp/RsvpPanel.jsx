// RSVP panel: shared by the home page's RSVP section, /rsvp and personal
// /rsvp/:token links. Business logic is unchanged — the API still validates,
// enforces party limits and capacity, and refuses to overwrite an open reply.
//   no token  open replies (when the couple allows them)
//   token     a household's private link: pre-filled, changeable until the deadline
import { CalendarCheck, Check, Loader2, MailCheck, Minus, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { errorMessage } from '../../lib/api.js'
import { formatDate, formatTime, isPastDeadline } from '../../lib/time.js'
import { LIMITS, validateRsvp } from '../../lib/validation.js'
import { getInvitation, submitRsvp } from '../../services/publicService.js'
import { Field, Honeypot } from '../ui/Field.jsx'
import { LoadError, Notice } from '../ui/Feedback.jsx'

/** "Please reply by …" pill, or null. */
export function DeadlinePill({ className = '' }) {
  const { settings, locale } = useSite()
  if (!settings.rsvp_deadline || isPastDeadline(settings.rsvp_deadline, settings.timezone)) return null
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border border-champagne bg-white/70 px-4 py-1.5 text-sm text-ink ${className}`}>
      <CalendarCheck className="size-4 text-gold" aria-hidden="true" />
      Please reply by {formatDate(settings.rsvp_deadline, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
  )
}

/** `renderHeading(guestName)` lets each page place its own title above the card. */
export function RsvpPanel({ token, renderHeading }) {
  const { status, ready, settings, events, locale } = useSite()
  const invitation = useAsync(() => (token ? getInvitation(token) : Promise.resolve(null)), [token])
  const rsvpEvents = events.filter((e) => e.rsvp_enabled)
  const pastDeadline = isPastDeadline(settings.rsvp_deadline, settings.timezone)

  let blocked = null
  if (ready) {
    if (settings.rsvp_mode === 'closed') blocked = { title: 'RSVPs are closed', text: 'Please contact the couple directly if you have any questions.' }
    else if (pastDeadline) blocked = { title: 'The RSVP deadline has passed', text: 'Please contact the couple directly if you still need to reply.' }
    else if (settings.rsvp_mode === 'invite_only' && !token) blocked = { title: 'Please use your personal link', text: 'RSVPs are made through the private link included with your invitation.' }
    else if (rsvpEvents.length === 0) blocked = { title: 'RSVPs are not open yet', text: 'Please check back soon.' }
  }

  return (
    <>
      {renderHeading?.(invitation.data?.name)}
      <div className="mx-auto max-w-2xl rounded-[1.5rem] border border-linen bg-white p-5 shadow-lift sm:p-10">
        {status === 'loading' || (token && invitation.loading) ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading your invitation…
          </p>
        ) : !ready ? (
          <Notice tone="error" title="RSVP is unavailable right now">
            The website could not reach its server, so replies can't be saved at the moment. Please try again shortly.
          </Notice>
        ) : token && invitation.error ? (
          <LoadError message={invitation.error} onRetry={invitation.reload} />
        ) : blocked ? (
          <Notice title={blocked.title}>{blocked.text}</Notice>
        ) : (
          <RsvpForm key={token ?? 'open'} token={token} invitation={invitation.data} events={rsvpEvents} locale={locale} />
        )}
      </div>
      {!token && ready && !blocked && (
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted">Received a personal RSVP link? Please use it — it lets you update your reply later.</p>
      )}
    </>
  )
}

function initialChoices(events, invitation) {
  const out = {}
  for (const e of events) {
    const prior = invitation?.responses?.find((r) => r.event_id === e.id)
    out[e.id] = prior ? { attending: Boolean(Number(prior.attending)), party: Math.max(1, Number(prior.party_size) || 1) } : { attending: null, party: 1 }
  }
  return out
}

function RsvpForm({ token, invitation, events, locale }) {
  const [values, setValues] = useState({
    name: invitation?.name ?? '',
    email: invitation?.email ?? '',
    phone: invitation?.phone ?? '',
    message: invitation?.responses?.find((r) => r.message)?.message ?? '',
  })
  const [choices, setChoices] = useState(() => initialChoices(events, invitation))
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState({ status: 'idle', message: '' })
  const hasPrior = Boolean(invitation?.responses?.length)

  const limitFor = (event) => Math.max(1, Math.min(event.max_party_size || 1, invitation?.max_party_size ?? event.max_party_size ?? 1))
  const responses = useMemo(
    () =>
      events
        .filter((e) => choices[e.id]?.attending !== null)
        .map((e) => ({ event_id: e.id, attending: choices[e.id].attending, party_size: choices[e.id].attending ? Math.min(choices[e.id].party, limitFor(e)) : 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, choices],
  )

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }
  const choose = (id, patch) => {
    setChoices((c) => ({ ...c, [id]: { ...c[id], ...patch } }))
    setErrors((er) => ({ ...er, responses: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (result.status === 'sending') return
    const found = validateRsvp(values, responses)
    setErrors(found)
    if (Object.keys(found).length) {
      document.querySelector('[aria-invalid="true"], [data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setResult({ status: 'sending', message: '' })
    try {
      const res = await submitRsvp({ token, ...values, responses, website })
      setResult(res.status === 'duplicate' ? { status: 'duplicate', message: '' } : { status: 'saved', message: '' })
    } catch (error) {
      setResult({ status: 'error', message: errorMessage(error) })
    }
  }

  if (result.status === 'saved' || result.status === 'duplicate') {
    const attending = responses.filter((r) => r.attending)
    return (
      <div className="py-4 text-center" role="status">
        <span className={`mx-auto grid size-16 place-items-center rounded-full ${result.status === 'saved' ? 'bg-sage-soft text-sage-deep' : 'bg-cream text-gold-deep'}`}>
          <MailCheck className="size-7" strokeWidth={1.4} aria-hidden="true" />
        </span>
        {result.status === 'saved' ? (
          <>
            <h2 className="mt-5 text-3xl">{attending.length ? 'We can’t wait to see you!' : 'Thank you for letting us know'}</h2>
            <p className="mt-3 text-muted">
              {attending.length ? 'Your RSVP has been saved.' : 'You will be missed. Your reply has been saved.'}
              {token && ' You can come back to this link to change it before the deadline.'}
            </p>
            <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
              {responses.map((r) => (
                <li key={r.event_id} className="flex items-center justify-between gap-3 rounded-xl bg-cream/70 px-4 py-2.5">
                  <span>{events.find((e) => e.id === r.event_id)?.title}</span>
                  <span className={r.attending ? 'text-sage-deep' : 'text-muted'}>{r.attending ? `Attending · ${r.party_size}` : 'Not attending'}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-3xl">We already have your reply</h2>
            <p className="mt-3 text-muted">An RSVP with these details was received earlier, so nothing was changed. To update it, please use your personal link or contact the couple.</p>
          </>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {token && (
            <button type="button" className="btn-outline" onClick={() => setResult({ status: 'idle', message: '' })}>
              Change my reply
            </button>
          )}
          <Link to="/" className="btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const sending = result.status === 'sending'
  return (
    <form onSubmit={submit} noValidate className="relative space-y-7">
      <Honeypot value={website} onChange={setWebsite} />
      {hasPrior && <Notice title="Your previous reply is shown below">Make any changes and save again.</Notice>}

      <Field label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} maxLength={LIMITS.rsvpName} error={errors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set('email')} maxLength={LIMITS.email} error={errors.email} hint="Optional" />
        <Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} maxLength={LIMITS.phone} error={errors.phone} hint="Optional" />
      </div>

      <fieldset className="space-y-4" data-error={errors.responses ? '' : undefined}>
        <legend className="field-label">Will you be joining us?</legend>
        {events.map((event) => (
          <EventChoice key={event.id} event={event} locale={locale} choice={choices[event.id]} limit={limitFor(event)} onChange={(patch) => choose(event.id, patch)} />
        ))}
        {errors.responses && (
          <p className="text-xs text-rose" role="alert">
            {errors.responses}
          </p>
        )}
      </fieldset>

      <Field as="textarea" rows={3} label="Message for the couple" hint="Optional — dietary needs, a note, anything" value={values.message} onChange={set('message')} maxLength={LIMITS.rsvpMessage} counter error={errors.message} />

      {result.status === 'error' && <Notice tone="error">{result.message}</Notice>}
      <button type="submit" className="btn-primary w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…
          </>
        ) : hasPrior ? (
          'Update my RSVP'
        ) : (
          'Send RSVP'
        )}
      </button>
    </form>
  )
}

function EventChoice({ event, locale, choice, limit, onChange }) {
  const option = (value, Icon, label) => {
    const active = choice.attending === value
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => onChange({ attending: value })}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm transition ${
          active ? (value ? 'border-sage-deep bg-sage-deep text-white shadow-soft' : 'border-ink bg-ink text-ivory shadow-soft') : 'border-champagne bg-white/70 text-ink hover:border-gold'
        }`}
      >
        <Icon className="size-4" aria-hidden="true" /> {label}
      </button>
    )
  }
  return (
    <div className="rounded-2xl border border-champagne bg-ivory/70 p-4 sm:p-5">
      <p className="font-serif text-2xl">{event.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {[formatDate(event.event_date, locale, { weekday: 'short', day: 'numeric', month: 'long' }), formatTime(event.start_time, locale), event.venue_name].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-4 flex gap-2.5" role="radiogroup" aria-label={`Attendance for ${event.title}`}>
        {option(true, Check, 'Joyfully accept')}
        {option(false, X, 'Regretfully decline')}
      </div>
      {choice.attending && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-white/70 px-4 py-3">
          <span className="text-sm text-ink">
            Number of guests
            <span className="block text-xs text-muted">Including you · up to {limit}</span>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="grid size-10 place-items-center rounded-full border border-champagne hover:border-gold disabled:opacity-40" onClick={() => onChange({ party: Math.max(1, choice.party - 1) })} disabled={choice.party <= 1} aria-label="Fewer guests">
              <Minus className="size-4" />
            </button>
            <output className="w-10 text-center font-serif text-2xl tabular-nums" aria-live="polite">
              {Math.min(choice.party, limit)}
            </output>
            <button type="button" className="grid size-10 place-items-center rounded-full border border-champagne hover:border-gold disabled:opacity-40" onClick={() => onChange({ party: Math.min(limit, choice.party + 1) })} disabled={choice.party >= limit} aria-label="More guests">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
