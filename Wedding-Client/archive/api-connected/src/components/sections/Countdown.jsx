import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSite } from '../../context/SiteContext.jsx'
import { labels } from '../../lib/labels.js'
import { countdownParts, formatDate, zonedInstant } from '../../lib/time.js'
import { Section, SectionTitle } from '../ui/Section.jsx'

const UNITS = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Minutes'],
  ['seconds', 'Seconds'],
]

/** Ticks once a second. The target comes from settings (one place: /admin → Settings). */
function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return { now, parts: countdownParts(target, now) }
}

export function Countdown() {
  const { settings, content, locale } = useSite()
  const L = labels(locale)
  const target = zonedInstant(settings.wedding_date, settings.wedding_time, settings.timezone)
  const { now, parts } = useCountdown(target)
  if (!target) return null
  const done = parts.done
  const today = done && now - target.getTime() < 86_400_000

  return (
    <Section id="countdown" tone="dark" className="py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(168_137_90/0.22),transparent_70%)]" aria-hidden="true" />
      <div className="relative">
        <SectionTitle light kicker={L.countdownKicker} title={formatDate(settings.wedding_date, locale, { day: 'numeric', month: 'long', year: 'numeric' })}>
          {content.hijriDate && <p className="font-serif text-lg italic">{content.hijriDate}</p>}
        </SectionTitle>

        {done ? (
          <p className="mt-10 text-center font-serif text-3xl text-champagne italic">{today ? 'Today is the day' : 'Thank you for celebrating with us'}</p>
        ) : (
          <div
            className="mx-auto mt-12 grid max-w-3xl grid-cols-4 divide-x divide-ivory/15"
            role="timer"
            aria-label={`${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes to go`}
          >
            {UNITS.map(([key, label]) => (
              <div key={key} className="flex flex-col items-center px-1" aria-hidden="true">
                <span className="relative h-12 overflow-hidden font-display text-[2.6rem] leading-[3rem] text-ivory tabular-nums sm:h-20 sm:text-7xl sm:leading-[5rem]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={parts[key]}
                      className="block"
                      initial={{ y: '-60%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: '60%', opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {String(parts[key]).padStart(2, '0')}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="mt-2 text-[0.6rem] font-semibold tracking-[0.3em] text-champagne/80 uppercase sm:text-[0.68rem]">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
