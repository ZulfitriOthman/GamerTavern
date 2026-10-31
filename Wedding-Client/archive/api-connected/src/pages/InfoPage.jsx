import { Check, ChevronDown, Copy, Gift, Mail, Map, MapPin, Phone, Shirt, Car } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Reveal } from '../components/ui/Reveal.jsx'
import { Ornament, PageHeader } from '../components/ui/Section.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { mapsLink } from '../lib/content.js'
import { formatDate, formatTimeRange } from '../lib/time.js'

export default function InfoPage() {
  const { content, events, locale, ready } = useSite()
  const { info } = content
  if (ready && content.sections.info === false) return <Navigate to="/" replace />
  const faq = (info.faq ?? []).filter((f) => f?.q)
  const contacts = (info.contacts ?? []).filter((c) => c?.name)

  return (
    <>
      <PageHeader eyebrow="Good to know" title="Wedding details">
        {info.scheduleNote && <p>{info.scheduleNote}</p>}
      </PageHeader>

      <div className="mx-auto max-w-5xl space-y-16 px-4">
        {events.length > 0 && (
          <section aria-labelledby="schedule">
            <Reveal>
              <h2 id="schedule" className="text-center text-3xl">
                Schedule &amp; venues
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-4">
              {events.map((e, i) => (
                <Reveal key={e.id} delay={i * 0.06} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div className="shrink-0 text-center sm:w-36 sm:border-r sm:border-champagne sm:pr-6">
                    <p className="eyebrow">{formatDate(e.event_date, locale, { weekday: 'short' })}</p>
                    <p className="font-serif text-3xl">{formatDate(e.event_date, locale, { day: 'numeric', month: 'short' }) || 'TBA'}</p>
                    <p className="text-xs text-muted">{formatTimeRange(e.start_time, e.end_time, locale)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-2xl">{e.title}</p>
                    {e.venue_name && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                        <span>
                          {e.venue_name}
                          {e.address && <span className="block">{e.address}</span>}
                        </span>
                      </p>
                    )}
                    {e.dress_code && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <Shirt className="size-4 shrink-0 text-gold" aria-hidden="true" /> {e.dress_code}
                      </p>
                    )}
                  </div>
                  {mapsLink(e) && (
                    <a href={mapsLink(e)} target="_blank" rel="noopener noreferrer" className="btn-outline min-h-10 shrink-0 px-4 text-xs">
                      <Map className="size-4" aria-hidden="true" /> Directions
                    </a>
                  )}
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {(info.dressCodeNote || info.travelNote) && (
          <section className="grid gap-5 md:grid-cols-2">
            {info.dressCodeNote && <NoteCard icon={Shirt} title="Dress code" text={info.dressCodeNote} />}
            {info.travelNote && <NoteCard icon={Car} title="Travel & parking" text={info.travelNote} />}
          </section>
        )}

        {info.gifts?.enabled && <GiftCard gifts={info.gifts} />}

        {faq.length > 0 && (
          <section aria-labelledby="faq">
            <Reveal className="text-center">
              <h2 id="faq" className="text-3xl">
                Questions &amp; answers
              </h2>
              <Ornament className="mt-4" />
            </Reveal>
            <div className="mx-auto mt-8 max-w-3xl divide-y divide-champagne overflow-hidden rounded-2xl border border-champagne bg-white/60">
              {faq.map((item, i) => (
                <details key={i} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-serif text-xl hover:bg-cream/60 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="size-5 shrink-0 text-gold transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed whitespace-pre-line text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {contacts.length > 0 && (
          <section aria-labelledby="contacts">
            <Reveal className="text-center">
              <h2 id="contacts" className="text-3xl">
                Need help?
              </h2>
              <p className="mt-2 text-sm text-muted">Reach out to any of us.</p>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contacts.map((c, i) => (
                <Reveal key={i} delay={i * 0.05} className="card p-5 text-center">
                  <p className="font-serif text-xl">{c.name}</p>
                  {c.role && <p className="text-xs tracking-[0.14em] text-muted uppercase">{c.role}</p>}
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {c.phone && (
                      <>
                        <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="btn-ghost min-h-9 px-3 text-xs">
                          <Phone className="size-3.5" aria-hidden="true" /> {c.phone}
                        </a>
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-9 px-3 text-xs">
                          WhatsApp
                        </a>
                      </>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="btn-ghost min-h-9 px-3 text-xs">
                        <Mail className="size-3.5" aria-hidden="true" /> Email
                      </a>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

function NoteCard({ icon: Icon, title, text }) {
  return (
    <Reveal className="card h-full p-6">
      <p className="flex items-center gap-2 font-serif text-2xl">
        <Icon className="size-5 text-gold" strokeWidth={1.5} aria-hidden="true" /> {title}
      </p>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted">{text}</p>
    </Reveal>
  )
}

function GiftCard({ gifts }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gifts.accountNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Reveal className="paper mx-auto max-w-xl p-6 text-center sm:p-8">
      <Gift className="mx-auto size-8 text-gold" strokeWidth={1.3} aria-hidden="true" />
      <h2 className="mt-3 text-3xl">Gifts</h2>
      {gifts.message && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted">{gifts.message}</p>}
      {gifts.accountNumber &&
        (shown ? (
          <div className="mt-6 rounded-2xl border border-champagne bg-white/70 p-5">
            {gifts.bankName && <p className="eyebrow">{gifts.bankName}</p>}
            {gifts.accountName && <p className="mt-1 text-ink">{gifts.accountName}</p>}
            <p className="mt-2 font-serif text-2xl tracking-wider tabular-nums">{gifts.accountNumber}</p>
            <button type="button" onClick={copy} className="btn-outline mt-4 min-h-10 px-4 text-xs" aria-live="polite">
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy account number'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn-outline mt-6" onClick={() => setShown(true)}>
            Show gift details
          </button>
        ))}
    </Reveal>
  )
}
