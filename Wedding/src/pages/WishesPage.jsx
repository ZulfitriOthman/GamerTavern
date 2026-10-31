import { Heart, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CharCount, Field, Honeypot } from '../components/ui/Field.jsx'
import { EmptyState, LoadingBlock, Notice, NotConnectedNotice } from '../components/ui/Feedback.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { WishCard } from '../components/wishes/WishCard.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { friendlyError } from '../lib/errors.js'
import { hasErrors, LIMITS, validateGreeting } from '../lib/validation.js'
import { listApprovedGreetings, submitGreeting } from '../services/greetingsService.js'

export function WishesPage() {
  const { settings, connected } = useSite()
  const [form, setForm] = useState({ name: '', relationship: '', message: '' })
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState({})
  const [submitState, setSubmitState] = useState({ status: 'idle', message: '' })
  const [list, setList] = useState({ items: [], page: 0, hasMore: false, loading: true, error: null })

  const loadPage = async (page) => {
    setList((l) => ({ ...l, loading: true, error: null }))
    try {
      const res = await listApprovedGreetings(page)
      setList((l) => ({ items: page === 0 ? res.items : [...l.items, ...res.items.filter((w) => !l.items.some((x) => x.id === w.id))], page, hasMore: res.hasMore, loading: false, error: null }))
    } catch (error) {
      setList((l) => ({ ...l, loading: false, error }))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage(0)
  }, [])

  // Other guests' wishes appear without a reload: quietly fetch the newest page
  // while visible and add anything new at the top (already-loaded pages are kept).
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await listApprovedGreetings(0)
        setList((l) => {
          const fresh = res.items.filter((w) => !l.items.some((x) => x.id === w.id))
          return fresh.length ? { ...l, items: [...fresh, ...l.items] } : l
        })
      } catch {
        // Background refresh only — the next attempt will try again.
      }
    }
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (submitState.status === 'sending') return
    const { errors: errs, values } = validateGreeting(form)
    setErrors(errs)
    if (hasErrors(errs)) return
    setSubmitState({ status: 'sending', message: '' })
    try {
      const result = await submitGreeting({ ...values, website })
      if (result.status === 'duplicate') {
        setSubmitState({ status: 'info', message: 'We have already received this message — thank you!' })
      } else {
        // Saved and published by the server: show it at the top straight away (no reload, no duplicates).
        setList((l) => ({ ...l, items: [result.item, ...l.items.filter((w) => w.id !== result.item.id)] }))
        setForm({ name: '', relationship: '', message: '' })
        setSubmitState({ status: 'success', message: 'Thank you! Your wish has been added to our guestbook.' })
      }
    } catch (err) {
      setSubmitState({ status: 'error', message: friendlyError(err) })
    }
  }

  return (
    <PageShell eyebrow="Guestbook" title="Leave Your Wishes" intro="Share a blessing, a memory, or a few words of love for the couple.">
      <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          {!settings.greetings_enabled ? (
            <Notice title="The guestbook is closed">Thank you for visiting — new wishes are not being accepted right now.</Notice>
          ) : (
            <Reveal>
              {!connected && <NotConnectedNotice feature="The guestbook" />}
              <form onSubmit={submit} noValidate className="card mt-4 space-y-5 p-6 sm:p-8">
                <Honeypot value={website} onChange={setWebsite} />
                <Field label="Your name" error={errors.name}>
                  {(p) => <input {...p} className="field-input" value={form.name} onChange={set('name')} maxLength={LIMITS.name} autoComplete="name" />}
                </Field>
                <Field label="Relationship to the couple" optional error={errors.relationship} hint="e.g. Friend of the bride, Cousin, Colleague">
                  {(p) => <input {...p} className="field-input" value={form.relationship} onChange={set('relationship')} maxLength={LIMITS.relationship} />}
                </Field>
                <Field label="Your wish" error={errors.message}>
                  {(p) => (
                    <>
                      <textarea
                        {...p}
                        rows={5}
                        className="field-input resize-y"
                        value={form.message}
                        onChange={set('message')}
                        maxLength={LIMITS.greeting}
                        placeholder="May your marriage be filled with love and happiness…"
                      />
                      <div className="mt-1 text-right">
                        <CharCount value={form.message} max={LIMITS.greeting} />
                      </div>
                    </>
                  )}
                </Field>
                <div aria-live="polite">
                  {submitState.status === 'success' && <Notice tone="success">{submitState.message}</Notice>}
                  {submitState.status === 'info' && <Notice>{submitState.message}</Notice>}
                  {submitState.status === 'error' && <Notice tone="error">{submitState.message}</Notice>}
                </div>
                <button type="submit" className="btn-primary w-full" disabled={submitState.status === 'sending' || !connected}>
                  {submitState.status === 'sending' ? <LoaderCircle className="size-4 animate-spin" /> : <Heart className="size-4" />}
                  {submitState.status === 'sending' ? 'Sending…' : 'Send wishes'}
                </button>
              </form>
            </Reveal>
          )}
        </div>

        <section aria-label="Wishes from our guests">
          {list.error ? (
            <Notice tone="error">{friendlyError(list.error)}</Notice>
          ) : list.items.length === 0 && list.loading ? (
            <LoadingBlock label="Loading wishes…" />
          ) : list.items.length === 0 ? (
            <EmptyState icon={Heart} title="Be the first">
              Wishes from our guests will appear here.
            </EmptyState>
          ) : (
            <>
              <div className="masonry !columns-1 sm:!columns-2">
                {list.items.map((w, i) => (
                  <WishCard key={w.id} wish={w} index={i} />
                ))}
              </div>
              {list.hasMore && (
                <div className="mt-8 text-center">
                  <button type="button" className="btn-outline" onClick={() => loadPage(list.page + 1)} disabled={list.loading}>
                    {list.loading ? 'Loading…' : 'Show more wishes'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  )
}
