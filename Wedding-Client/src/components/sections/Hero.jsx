// Opening: Bismillah, the majlis title, the couple's names, day, date, Hijri date and venue inside
// a large layered mihrab arch on a light grey geometric ground, with burgundy
// florals at its lower corners and along its bottom edge.
import { motion } from 'motion/react'
import { ChevronDown, MapPin } from 'lucide-react'
import { weddingData } from '../../data/weddingData.js'
import { FloralCorner, FloralDivider, FloralGarland } from '../decor/Floral.jsx'
import { MihrabFrame } from '../decor/Geometric.jsx'

const EASE = [0.22, 1, 0.36, 1]

/** Fade-up that waits until `play` (the invitation has been opened). */
const rise = (play, delay) => ({
  initial: { opacity: 0, y: 18 },
  animate: play ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
  transition: { duration: 1, delay, ease: EASE },
})

/** "AKAD NIKAH & BERSANDING": the "&" in italic serif; stacks on phones. */
function TitleLine({ text }) {
  return text.split(/\s*&\s*/).map((piece, j) => (
    <span key={j}>
      {j > 0 && <span className="block py-0.5 font-serif text-[1.3em] leading-none tracking-normal text-floral normal-case italic sm:mx-3 sm:inline sm:py-0">&amp;</span>}
      <span className="block sm:inline">{piece}</span>
    </span>
  ))
}

export function Hero({ play = true }) {
  const { opening, event, venue, couple } = weddingData
  const [lead, ...rest] = event.titleLines
  // The supplied title has a comma after the first line ("…BERIAN, AKAD NIKAH…").
  const leadText = event.title.startsWith(`${lead},`) ? `${lead},` : lead
  return (
    <section id="utama" className="bg-geometric relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-mist px-3 pt-24 pb-20 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_48%_at_50%_48%,rgb(255_255_255/0.95),rgb(255_255_255/0.5)_60%,transparent_85%)]" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 1.2, ease: EASE }}
        className="@container relative isolate w-full max-w-[39rem]"
      >
        <MihrabFrame className="-z-10" />

        <motion.div {...rise(play, 0.9)} className="absolute -bottom-4 -left-3 z-10 sm:-bottom-8 sm:-left-24">
          <FloralCorner position="bottom-left" size="w-32 sm:w-52" />
        </motion.div>
        <motion.div {...rise(play, 0.9)} className="absolute -right-3 -bottom-4 z-10 sm:-right-24 sm:-bottom-8">
          <FloralCorner position="bottom-right" size="w-32 sm:w-52" />
        </motion.div>
        <motion.div {...rise(play, 1.05)} className="absolute bottom-0 left-1/2 z-10 w-[17rem] -translate-x-1/2 translate-y-[45%] sm:w-[25rem]">
          <FloralGarland className="w-full" />
        </motion.div>

        <div className="relative px-7 pt-[max(6.5rem,27cqw)] pb-24 text-center sm:px-14 sm:pb-36">
          <motion.p {...rise(play, 0.25)} lang="ar" dir="rtl" className="font-arabic text-[1.9rem] leading-loose text-primary sm:text-[2.4rem]">
            {opening.arabic}
          </motion.p>
          <motion.p {...rise(play, 0.35)} className="font-serif text-lg text-bronze-deep italic">
            {opening.latin}
          </motion.p>

          <motion.div {...rise(play, 0.45)}>
            <FloralDivider className="mt-5" />
            <h1 className="mt-5 font-display text-primary uppercase">
              <span aria-hidden="true" className="block text-[0.8rem] leading-relaxed tracking-[0.2em] text-ink sm:text-[1.02rem] sm:tracking-[0.26em]">
                {leadText}
              </span>
              {rest.map((line) => (
                <span key={line} aria-hidden="true" className="mt-2.5 block text-[1.7rem] leading-[1.15] tracking-[0.08em] sm:text-[1.5rem] sm:whitespace-nowrap md:text-[1.7rem]">
                  <TitleLine text={line} />
                </span>
              ))}
              <span className="sr-only">{event.title}</span>
            </h1>
          </motion.div>

          <motion.div {...rise(play, 0.52)} className="mt-7">
            <p className="sr-only">
              {couple.groom.name} &amp; {couple.bride.name}
            </p>
            <p aria-hidden="true" className="font-serif text-[1.7rem] leading-[1.15] font-medium text-balance text-primary italic [overflow-wrap:anywhere] sm:text-[2.5rem]">
              <span className="block">{couple.groom.name}</span>
              <span className="my-1 block font-serif text-[0.8em] text-floral">&amp;</span>
              <span className="block">{couple.bride.name}</span>
            </p>
          </motion.div>

          <motion.div {...rise(play, 0.6)} className="mx-auto mt-8 max-w-xs border-y border-line py-5">
            <p className="font-display text-[0.8rem] font-medium tracking-[0.42em] text-bronze-deep uppercase">{event.day}</p>
            <p className="mt-1.5 font-display text-[1.65rem] tracking-[0.14em] text-ink uppercase sm:text-[1.9rem]">{event.dateText}</p>
            <p className="mt-1.5 font-display text-[0.8rem] font-medium tracking-[0.26em] text-bronze-deep uppercase">{event.hijriDate}</p>
          </motion.div>

          <motion.p {...rise(play, 0.7)} className="mt-5 flex items-center justify-center gap-2 font-display text-[0.78rem] font-medium tracking-[0.2em] text-ink uppercase">
            <MapPin className="size-4 shrink-0 text-floral" strokeWidth={1.5} aria-hidden="true" />
            {venue.name}
          </motion.p>

          <motion.div {...rise(play, 0.8)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#atur-cara" className="btn-primary w-full max-w-52 sm:w-auto">
              Atur Cara
            </a>
            <a href="#tempat" className="btn-outline w-full max-w-52 sm:w-auto">
              Tempat Majlis
            </a>
          </motion.div>
        </div>
      </motion.div>

      <motion.a
        href="#countdown"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full p-2 text-bronze"
        aria-label="Tatal ke bawah"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <ChevronDown className="size-6" />
      </motion.a>
    </section>
  )
}
