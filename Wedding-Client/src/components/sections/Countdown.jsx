import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { weddingData } from '../../data/weddingData.js'
import { calendarEvent } from '../../lib/content.js'
import { countdownParts, zonedInstant } from '../../lib/time.js'
import { CalendarMenu } from '../events/CalendarMenu.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

const UNITS = [
  ['days', 'Hari'],
  ['hours', 'Jam'],
  ['minutes', 'Minit'],
  ['seconds', 'Saat'],
]

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Counts down (in Brunei time) to the start of the guest reception. */
export function Countdown() {
  const { event, venue, couple } = weddingData
  const target = zonedInstant(event.date, event.startTime, event.timeZone)
  const now = useNow()
  const parts = countdownParts(target, now)

  return (
    <Section id="countdown" tone="ivory">
      <SectionTitle eyebrow="Menghitung Hari" title={event.dateText}>
        <p className="font-serif text-xl text-bronze-deep italic">
          {event.day} · {event.hijriDate}
        </p>
        <p className="mt-1.5 text-sm">Menerima Jemputan bermula {event.startTimeText}</p>
      </SectionTitle>

      {parts.done ? (
        <p className="mt-12 text-center font-serif text-3xl text-primary italic">
          {now - target.getTime() < 86_400_000 ? 'Majlis berlangsung hari ini' : 'Terima kasih atas kehadiran dan doa restu'}
        </p>
      ) : (
        <Reveal
          className="mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-2.5 sm:gap-6"
          role="timer"
          aria-label={`${parts.days} hari, ${parts.hours} jam dan ${parts.minutes} minit lagi`}
        >
          {UNITS.map(([key, label]) => (
            <div key={key} className="flex flex-col items-center" aria-hidden="true">
              <div className="arch relative grid aspect-[4/5] w-full max-w-32 place-items-center border border-haze bg-white pt-[18%] shadow-soft">
                <span className="arch absolute inset-1.5 border border-bronze/30" />
                <span className="relative h-9 overflow-hidden font-serif text-[2rem] leading-9 font-medium text-primary tabular-nums sm:h-14 sm:text-5xl sm:leading-[3.5rem]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={parts[key]}
                      className="block"
                      initial={{ y: '-70%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: '70%', opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {String(parts[key]).padStart(2, '0')}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
              <span className="mt-3 font-display text-[0.64rem] font-medium tracking-[0.24em] text-bronze-deep uppercase sm:text-[0.72rem]">{label}</span>
            </div>
          ))}
        </Reveal>
      )}

      <Reveal className="mt-12 flex justify-center">
        <CalendarMenu event={calendarEvent(event, venue, couple)} timeZone={event.timeZone} label="Simpan ke Kalendar" />
      </Reveal>
    </Section>
  )
}
