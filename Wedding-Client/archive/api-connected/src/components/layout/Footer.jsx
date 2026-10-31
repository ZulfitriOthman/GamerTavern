import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { useNavItems, useSiteSections } from '../../hooks/useSiteSections.js'
import { coupleNames, siteTitle } from '../../lib/content.js'
import { formatDate } from '../../lib/time.js'
import { Ornament } from '../ui/Section.jsx'

export function Footer() {
  const { content, settings, events, locale } = useSite()
  const items = useNavItems()
  const visible = useSiteSections()
  const { a, b } = coupleNames(content.couple)
  const extra = [
    { to: '/#rsvp', label: 'RSVP' },
    settings.photo_uploads_enabled && { to: '/share', label: 'Share photos' },
    visible.info && { to: '/info', label: 'Details & FAQ' },
  ].filter(Boolean)

  return (
    <footer className="relative overflow-hidden bg-espresso px-4 pt-20 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center text-ivory">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_70%_at_50%_100%,rgb(168_137_90/0.18),transparent_70%)]" aria-hidden="true" />
      <div className="relative">
        {a && b ? (
          <p className="font-script text-6xl text-champagne sm:text-7xl">
            {a} <span className="font-display text-3xl text-ivory/60">&amp;</span> {b}
          </p>
        ) : (
          <p className="mx-auto max-w-2xl font-display text-xl tracking-[0.14em] text-balance text-champagne uppercase sm:text-2xl">{siteTitle(content, events)}</p>
        )}
        {settings.wedding_date && <p className="mt-5 text-[0.7rem] font-semibold tracking-[0.32em] text-ivory/70 uppercase">{formatDate(settings.wedding_date, locale)}</p>}
        <p className="mx-auto mt-6 max-w-md font-serif text-xl leading-relaxed whitespace-pre-line text-ivory/85 italic">
          {content.footer.message || 'Thank you for being part of our special day.'}
        </p>
        {content.couple.hashtag && <p className="mt-3 text-sm tracking-[0.12em] text-champagne">#{content.couple.hashtag.replace(/^#/, '')}</p>}
        <Ornament light className="mt-10" />
        <nav aria-label="Footer" className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3 text-[0.68rem] font-semibold tracking-[0.24em] text-ivory/70 uppercase">
          {[...items, ...extra].map((item) => (
            <Link key={item.to} to={item.to} className="py-1 transition hover:text-champagne">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
