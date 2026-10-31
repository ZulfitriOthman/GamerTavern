import { Check, ChevronDown, Copy, Gift, Mail, MapPin, Phone, Shirt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { mapsLink } from '../lib/calendar.js'
import { formatDate, formatTimeRange } from '../lib/time.js'

function InfoCard({ icon: Icon, title, children, delay = 0 }) {
  return (
    <Reveal delay={delay} className="card p-7 sm:p-8">
      <Icon className="size-6 text-gold" strokeWidth={1.4} aria-hidden="true" />
      <h2 className="mt-4 text-3xl">{title}</h2>
      <div className="mt-3 text-base leading-[1.7] text-muted">{children}</div>
    </Reveal>
  )
}

export function InfoPage() {
  const { content, events } = useSite()
  const { info } = content
  const faq = (info.faq ?? []).filter((f) => f?.q)
  const contacts = (info.contacts ?? []).filter((c) => c?.name)

  return (
    <PageShell eyebrow="Good to know" title="Wedding Details" intro="Everything you need to plan your day with us.">
      {/* Schedule */}
      {events.length > 0 && (
        <Reveal className="card mb-6 p-7 sm:p-10">
          <h2 className="text-3xl">Schedule</h2>
          <ul className="mt-6 divide-y divide-champagne">
            {events.map((e) => {
              const directions = mapsLink(e)
              return (
                <li key={e.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-serif text-xl text-ink">{e.title}</p>
                    <p className="text-base text-muted">
                      {[e.event_date && formatDate(e.event_date, content.locale), formatTimeRange(e.start_time, e.end_time, content.locale)].filter(Boolean).join(' · ') ||
                        'Date to be announced'}
                    </p>
                    {e.venue_name && <p className="text-base text-muted">{e.venue_name}</p>}
                  </div>
                  {directions && (
                    <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm self-start sm:self-center">
                      <MapPin className="size-3.5" /> Map
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
          <Link to="/events" className="btn-ghost btn-sm mt-4 -ml-4">
            Full programme →
          </Link>
        </Reveal>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {info.dressCodeNote && (
          <InfoCard icon={Shirt} title="Dress Code">
            <p className="whitespace-pre-line">{info.dressCodeNote}</p>
          </InfoCard>
        )}
        {info.travelNote && (
          <InfoCard icon={MapPin} title="Getting There" delay={0.05}>
            <p className="whitespace-pre-line">{info.travelNote}</p>
          </InfoCard>
        )}
        {contacts.length > 0 && (
          <InfoCard icon={Phone} title="Contact" delay={0.1}>
            <ul className="space-y-4">
              {contacts.map((c, i) => (
                <li key={i}>
                  <p className="font-medium text-ink">{c.name}</p>
                  {c.role && <p className="text-sm">{c.role}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-gold-deep hover:underline">
                        <Phone className="size-3.5" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-gold-deep hover:underline">
                        <Mail className="size-3.5" /> {c.email}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </InfoCard>
        )}
        {info.gifts?.enabled && <GiftCard gifts={info.gifts} />}
      </div>

      {faq.length > 0 && (
        <section className="mt-20">
          <h2 className="text-center text-4xl sm:text-5xl">Questions &amp; Answers</h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {faq.map((item, i) => (
              <Reveal key={i} delay={i * 0.03}>
                <details className="group card px-6 py-1 open:pb-5">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="size-5 shrink-0 text-gold transition group-open:rotate-180" />
                  </summary>
                  <p className="text-base leading-[1.7] whitespace-pre-line text-muted">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}

function GiftCard({ gifts }) {
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
    <InfoCard icon={Gift} title="Gifts" delay={0.15}>
      <p className="whitespace-pre-line">{gifts.message}</p>
      {gifts.accountNumber && (
        <div className="mt-4 rounded-2xl bg-cream/80 p-4">
          {gifts.bankName && <p className="text-sm font-medium tracking-[0.1em] uppercase">{gifts.bankName}</p>}
          {gifts.accountName && <p className="mt-1 text-ink">{gifts.accountName}</p>}
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="font-serif text-xl tracking-wider text-ink tabular-nums">{gifts.accountNumber}</p>
            <button type="button" onClick={copy} className="btn-ghost btn-sm" aria-label="Copy account number">
              {copied ? <Check className="size-4 text-sage-deep" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </InfoCard>
  )
}
