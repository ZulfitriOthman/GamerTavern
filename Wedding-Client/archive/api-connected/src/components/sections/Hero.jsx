// Full-screen opening section. With a photo (uploaded in /admin, or
// public/images/wedding/hero.jpg) the names sit over the image; without one,
// an arched invitation frame on ivory keeps it looking intentional.
import { motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { LOCAL_IMAGES } from '../../config/images.js'
import { useSite } from '../../context/SiteContext.jsx'
import { useSiteSections } from '../../hooks/useSiteSections.js'
import { mediaUrl } from '../../lib/api.js'
import { coupleNames, siteTitle } from '../../lib/content.js'
import { labels } from '../../lib/labels.js'
import { formatDate, formatTime } from '../../lib/time.js'

const rise = (delay) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] },
})

/** Loads the first working photo. status: 'pending' | 'photo' | 'none'. */
function useHeroPhoto(sources) {
  const list = sources.filter(Boolean).map(mediaUrl)
  const key = list.join('|')
  const [state, setState] = useState({ key, index: 0, status: list.length ? 'pending' : 'none' })
  const current = state.key === key ? state : { key, index: 0, status: list.length ? 'pending' : 'none' }

  // A slow photo shouldn't hold the names back: after 2.5s show the photo layout anyway.
  useEffect(() => {
    if (current.status !== 'pending') return
    const t = setTimeout(() => setState((s) => (s.key === key && s.status === 'pending' ? { ...s, status: 'photo' } : s)), 2500)
    return () => clearTimeout(t)
  }, [key, current.status])

  return {
    src: current.status === 'none' ? null : list[current.index],
    status: current.status,
    onLoad: () => setState({ ...current, status: 'photo' }),
    onError: () => setState(current.index + 1 < list.length ? { ...current, index: current.index + 1 } : { ...current, status: 'none' }),
  }
}

/** "MAJLIS X, AKAD NIKAH & BERSANDING" set as stacked engraved capitals. */
function TitleHeading({ title, light }) {
  const parts = title.split(/,\s*/).filter(Boolean)
  const [lead, ...rest] = parts.length > 1 ? parts : [null, ...parts]
  return (
    <h1 className={`mx-auto max-w-5xl font-display uppercase ${light ? 'text-ivory' : 'text-ink'}`}>
      {lead && (
        <span className={`block text-[0.95rem] leading-snug tracking-[0.22em] sm:text-xl sm:tracking-[0.32em] md:text-2xl ${light ? 'text-champagne' : 'text-gold-deep'}`}>
          {lead}
          <span className="sr-only">,</span>
        </span>
      )}
      {rest.map((part, i) => (
        <span key={i} className={`block text-[2.1rem] leading-[1.15] tracking-[0.1em] sm:text-[2.1rem] sm:whitespace-nowrap md:text-[2.5rem] lg:text-[2.9rem] xl:text-[3.1rem] ${lead ? 'mt-3 sm:mt-4' : ''}`}>
          {part.split(/\s*&\s*/).map((piece, j) => (
            <span key={j}>
              {j > 0 && <span className={`block py-1 font-script text-[1.3em] leading-none tracking-normal normal-case sm:ml-3 sm:mr-5 sm:inline sm:py-0 ${light ? 'text-champagne' : 'text-gold'}`}>&amp;</span>}
              <span className="block sm:inline">{piece}</span>
            </span>
          ))}
        </span>
      ))}
    </h1>
  )
}

export function Hero({ delay = 0 }) {
  const { content, settings, events, locale, status } = useSite()
  const visible = useSiteSections()
  const L = labels(locale)
  const { a, b } = coupleNames(content.couple)
  const photo = useHeroPhoto([content.hero.imageUrl, LOCAL_IMAGES.hero])
  const light = photo.status === 'photo' || photo.status === 'pending'
  const decided = photo.status !== 'pending' && status !== 'loading'
  const d = delay
  const setHeroTone = useOutletContext()?.setHeroTone
  useEffect(() => setHeroTone?.(light ? 'light' : 'dark'), [light, setHeroTone])

  return (
    <section id="home" className={`relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pt-32 pb-24 text-center ${photo.status === 'none' ? 'bg-ivory' : 'bg-espresso'}`}>
      {photo.src && (
        <>
          <img
            src={photo.src}
            alt=""
            onLoad={photo.onLoad}
            onError={photo.onError}
            fetchPriority="high"
            className={`absolute inset-0 -z-20 size-full animate-slow-zoom object-cover transition-opacity duration-1000 ${photo.status === 'photo' ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-espresso/55 via-espresso/30 to-espresso/75" aria-hidden="true" />
        </>
      )}
      {photo.status === 'none' && <ArchBackdrop />}

      {decided && (
        <div className="relative mx-auto w-full max-w-4xl">
          {content.hero.eyebrow && (
            <motion.p {...rise(d + 0.1)} className={`eyebrow ${light ? 'text-champagne' : ''}`}>
              {content.hero.eyebrow}
            </motion.p>
          )}

          <motion.div {...rise(d + 0.25)} className="mt-5">
            {a || b ? (
              <h1 className={`font-script text-[4rem] leading-[1] font-normal sm:text-8xl lg:text-[7.25rem] ${light ? 'text-ivory' : 'text-gold-deep'}`}>
                {a}
                {a && b && <span className={`mx-4 block font-display text-3xl sm:inline sm:text-5xl ${light ? 'text-champagne' : 'text-taupe'}`}>&amp;</span>}
                {b}
              </h1>
            ) : (
              <TitleHeading title={siteTitle(content, events)} light={light} />
            )}
          </motion.div>

          {content.hero.tagline && (
            <motion.p {...rise(d + 0.4)} className={`mx-auto mt-6 max-w-xl font-serif text-2xl italic text-balance ${light ? 'text-ivory/90' : 'text-muted'}`}>
              {content.hero.tagline}
            </motion.p>
          )}

          {settings.wedding_date && (
            <motion.div {...rise(d + 0.55)} className="mt-9">
              <div className={`mx-auto flex max-w-md items-center justify-center gap-4 ${light ? 'text-ivory' : 'text-ink'}`}>
                <span className={`h-px flex-1 ${light ? 'bg-ivory/40' : 'bg-gold/50'}`} aria-hidden="true" />
                <p className="font-display text-lg tracking-[0.22em] uppercase sm:text-xl">{formatDate(settings.wedding_date, locale)}</p>
                <span className={`h-px flex-1 ${light ? 'bg-ivory/40' : 'bg-gold/50'}`} aria-hidden="true" />
              </div>
              <p className={`mt-3 text-[0.72rem] font-semibold tracking-[0.28em] uppercase ${light ? 'text-ivory/75' : 'text-muted'}`}>
                {[content.hijriDate, formatTime(settings.wedding_time, locale)].filter(Boolean).join('  ·  ')}
              </p>
            </motion.div>
          )}

          <motion.div {...rise(d + 0.7)} className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/#rsvp" className={`${light ? 'btn-gold' : 'btn-primary'} w-full max-w-64 sm:w-auto`}>
              {L.rsvp}
            </Link>
            {visible.events && (
              <Link to="/#events" className={`${light ? 'btn-light' : 'btn-outline'} w-full max-w-64 sm:w-auto`}>
                {L.details}
              </Link>
            )}
            {visible.story && (
              <Link to="/#story" className={`${light ? 'btn-light' : 'btn-outline'} w-full max-w-64 sm:w-auto`}>
                Our Story
              </Link>
            )}
          </motion.div>
        </div>
      )}

      <motion.a
        href="#countdown"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full p-2 ${light ? 'text-ivory/80' : 'text-muted'}`}
        aria-label="Scroll down"
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <ChevronDown className="size-6" />
      </motion.a>
    </section>
  )
}

/** Photo-free hero: concentric gold arches on warm ivory. */
function ArchBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_45%,var(--color-beige),transparent_75%)]" />
      <div className="arch absolute top-[11%] bottom-[11%] left-1/2 w-[min(92vw,820px)] -translate-x-1/2 border border-gold/45" />
      <div className="arch absolute top-[calc(11%+14px)] bottom-[calc(11%+14px)] left-1/2 w-[calc(min(92vw,820px)-28px)] -translate-x-1/2 border border-gold/20" />
    </div>
  )
}
