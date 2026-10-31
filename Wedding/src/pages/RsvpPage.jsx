import { CalendarHeart, Check, LoaderCircle, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Field, Honeypot } from '../components/ui/Field.jsx'
import { LoadingBlock, Notice, NotConnectedNotice } from '../components/ui/Feedback.jsx'
import { Divider } from '../components/ui/Ornaments.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { friendlyError } from '../lib/errors.js'
import { formatDate, formatTimeRange, isPastDeadline } from '../lib/time.js'
import { useAsync } from '../hooks/useAsync.js'
import { hasErrors, LIMITS, validateRsvp } from '../lib/validation.js'
import { getInvitation, submitRsvp } from '../services/rsvpService.js'

export function RsvpPage() {
  const { token } = useParams()
  const { settings, events, content, connected, status } = useSite()
  const invitation = useAsync(() => (token && connected ? getInvitation(token) : Promise.resolve(null)), [token])

  const rsvpEvents = events.filter((e) => e.rsvp_enabled)
  const deadlinePassed = isPastDeadline(settings.rsvp_deadline, settings.timezone)
  const deadlineText = settings.rsvp_deadline ? formatDate(settings.rsvp_deadline, content.locale) : null

  let blocker = null
  if (settings.rsvp_mode === 'closed') blocker = 'RSVPs are now closed. If you have any questions, please contact the couple.'
  else if (deadlinePassed) blocker = `The RSVP deadline (${deadlineText}) has passed. Please contact the couple directly.`
  else if (settings.rsvp_mode === 'invite_only' && !token)
    blocker = 'Please use the personal RSVP link included with your invitation so we can find your reservation.'

  return (
    <PageShell
      eyebrow="Kindly respond"
      title="RSVP"
      width="narrow"
      intro={deadlineText && !blocker ? `We would be grateful for your reply by ${deadlineText}.` : 'We would be delighted to celebrate with you.'}
    >
      {!connected && <NotConnectedNotice feature="RSVP" />}
      {blocker ? (
        <Notice title="RSVP unavailable">{blocker}</Notice>
      ) : status === 'loading' || (token && invitation.loading) ? (
        <LoadingBlock label="Loading your invitation…" />
      ) : token && invitation.error ? (
        <Notice tone="error">{friendlyError(invitation.error)}</Notice>
      ) : token && connected && !invitation.data ? (
        <Notice tone="error" title="Invitation not found">
          This RSVP link is not valid. Please check that you copied the full link, or contact the couple.
        </Notice>
      ) : rsvpEvents.length === 0 ? (
        <Notice title="RSVP opening soon">The celebrations are still being finalised. Please check back shortly.</Notice>
      ) : (
        <RsvpForm key={token ?? 'open'} token={token} invitation={invitation.data} events={rsvpEvents} disabled={!connected} />
      )}
    </PageShell>
  )
}

function initialResponses(events, invitation) {
  const existing = new Map((invitation?.responses ?? []).map((r) => [r.event_id, r]))
  return Object.fromEntries(
    events.map((e) => {
      const r = existing.get(e.id)
      return [e.id, r ? { attending: r.attending, party_size: r.attending ? r.party_size : 1 } : { attending: null, party_size: 1 }]
    }),
  )
}

function RsvpForm({ token, invitation, events, disabled }) {
  const { content } = useSite()
  const hasExisting = (invitation?.responses?.length ?? 0) > 0
  const [form, setForm] = useState({
    name: invitation?.name ?? '',
    email: invitation?.email ?? '',
    phone: invitation?.phone ?? '',
    message: invitation?.responses?.find((r) => r.message)?.message ?? '',
  })
  const [responses, setResponses] = useState(() => initialResponses(events, invitation))
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState({})
  const [state, setState] = useState({ status: 'idle', message: '' })

  const maxFor = (event) => Math.min(event.max_party_size ?? 20, invitation?.max_party_size ?? 20)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setResponse = (id, patch) => setResponses((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const submit = async (e) => {
    e.preventDefault()
    if (state.status === 'sending') return
    const list = events.map((ev) => ({ event_id: ev.id, ...responses[ev.id], max: maxFor(ev) }))
    const { errors: errs, values } = validateRsvp({ ...form, responses: list })
    setErrors(errs)
    if (hasErrors(errs)) return
    setState({ status: 'sending', message: '' })
    try {
      const result = await submitRsvp({ ...values, token, website })
      if (result?.status === 'duplicate') {
        setState({
          status: 'duplicate',
          message:
            'We already have an RSVP with these details. To make changes, please use the personal link from your invitation or contact the couple.',
        })
      } else {
        setState({ status: 'done', message: '', summary: values })
      }
    } catch (err) {
      setState({ status: 'error', message: friendlyError(err) })
    }
  }

  if (state.status === 'done') {
    const attending = state.summary.responses.filter((r) => r.attending)
    return (
      <Reveal className="card px-6 py-12 text-center sm:px-12">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-sage-soft text-sage-deep">
          <Check className="size-8" />
        </div>
        <h2 className="mt-6 text-4xl">Thank you, {state.summary.name.split(' ')[0]}!</h2>
        <Divider className="mt-5" />
        <p className="mx-auto mt-5 max-w-md text-muted">
          {attending.length > 0
            ? 'Your RSVP has been saved. We cannot wait to celebrate with you!'
            : 'Your RSVP has been saved. We will miss you, and thank you for letting us know.'}
        </p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-base">
          {state.summary.responses.map((r) => {
            const ev = events.find((e) => e.id === r.event_id)
            return (
              <li key={r.event_id} className="flex justify-between gap-4 rounded-xl bg-cream/70 px-4 py-2.5">
                <span className="text-ink">{ev?.title}</span>
                <span className={r.attending ? 'text-sage-deep' : 'text-muted'}>
                  {r.attending ? `Attending · ${r.party_size}` : 'Not attending'}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {token && (
            <button type="button" className="btn-outline" onClick={() => setState({ status: 'idle', message: '' })}>
              Edit my response
            </button>
          )}
          <Link to="/events" className="btn-ghost">
            View event details
          </Link>
        </div>
      </Reveal>
    )
  }

  return (
    <Reveal>
      <form onSubmit={submit} noValidate className="card space-y-7 p-6 sm:p-10">
        <Honeypot value={website} onChange={setWebsite} />

        {invitation && (
          <div className="text-center">
            <p className="eyebrow">{content.invitation.salutation}</p>
            <p className="mt-2 font-serif text-3xl text-ink">{invitation.name}</p>
            {content.invitation.nameNote && <p className="mt-1 text-sm text-muted italic">{content.invitation.nameNote}</p>}
            <p className="mt-4 text-base text-muted">
              We have reserved {invitation.max_party_size} {invitation.max_party_size === 1 ? 'seat' : 'seats'} in your honour.
              {hasExisting && ' Your previous reply is shown below — feel free to update it.'}
            </p>
          </div>
        )}

        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} className="field-input" value={form.name} onChange={setField('name')} maxLength={LIMITS.rsvpName} autoComplete="name" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" optional error={errors.email}>
            {(p) => <input {...p} type="email" inputMode="email" className="field-input" value={form.email} onChange={setField('email')} autoComplete="email" maxLength={LIMITS.email} />}
          </Field>
          <Field label="Phone" optional error={errors.phone}>
            {(p) => <input {...p} type="tel" inputMode="tel" className="field-input" value={form.phone} onChange={setField('phone')} autoComplete="tel" maxLength={LIMITS.phone} />}
          </Field>
        </div>

        <fieldset className="space-y-4">
          <legend className="field-label">Your attendance</legend>
          {events.map((event) => {
            const r = responses[event.id]
            const max = maxFor(event)
            return (
              <div key={event.id} className={`rounded-3xl border p-5 transition ${r.attending ? 'border-sage bg-sage-soft/40' : 'border-champagne bg-ivory/60'}`}>
                <div className="flex items-start gap-3">
                  <CalendarHeart className="mt-1 size-5 shrink-0 text-gold-deep" />
                  <div>
                    <p className="font-serif text-2xl leading-tight">{event.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {[event.event_date && formatDate(event.event_date, content.locale), formatTimeRange(event.start_time, event.end_time, content.locale), event.venue_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Attendance for ${event.title}`}>
                  {[
                    [true, 'Joyfully accept'],
                    [false, 'Regretfully decline'],
                  ].map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={r.attending === value}
                      onClick={() => setResponse(event.id, { attending: value })}
                      className={`min-h-12 rounded-2xl border px-3 text-base font-medium transition ${
                        r.attending === value ? 'border-ink bg-ink text-ivory' : 'border-sand bg-white/70 text-ink hover:border-gold'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {r.attending && max > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-base text-muted">Number of guests (including you)</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="grid size-10 place-items-center rounded-full border border-sand hover:border-gold disabled:opacity-40"
                        onClick={() => setResponse(event.id, { party_size: Math.max(1, r.party_size - 1) })}
                        disabled={r.party_size <= 1}
                        aria-label="Fewer guests"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-10 text-center font-serif text-2xl tabular-nums" aria-live="polite">
                        {r.party_size}
                      </span>
                      <button
                        type="button"
                        className="grid size-10 place-items-center rounded-full border border-sand hover:border-gold disabled:opacity-40"
                        onClick={() => setResponse(event.id, { party_size: Math.min(max, r.party_size + 1) })}
                        disabled={r.party_size >= max}
                        aria-label="More guests"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {errors.responses && <p className="field-error">{errors.responses}</p>}
        </fieldset>

        <Field label="A note for the couple" optional error={errors.message} hint="Dietary requirements, song requests or a few kind words.">
          {(p) => <textarea {...p} rows={3} className="field-input resize-y" value={form.message} onChange={setField('message')} maxLength={LIMITS.rsvpMessage} />}
        </Field>

        <div aria-live="polite">
          {state.status === 'error' && <Notice tone="error">{state.message}</Notice>}
          {state.status === 'duplicate' && <Notice tone="warning">{state.message}</Notice>}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={disabled || state.status === 'sending'}>
          {state.status === 'sending' && <LoaderCircle className="size-4 animate-spin" />}
          {state.status === 'sending' ? 'Sending…' : hasExisting ? 'Update my RSVP' : 'Send RSVP'}
        </button>
      </form>
    </Reveal>
  )
}
