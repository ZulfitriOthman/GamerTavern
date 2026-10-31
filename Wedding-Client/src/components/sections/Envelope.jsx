// Invitation cover shown once per visit: two white paper flaps meeting in the
// centre, closed with a burgundy wax seal under a small spray of flowers.
// "Buka Undangan" (or the seal) fades the seal away and swings the flaps open
// onto the invitation. Reduced-motion visitors get a simple fade; "Langkau"
// skips straight in.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FloralGarland } from '../decor/Floral.jsx'
import { EightPointStar } from '../decor/Geometric.jsx'

const EASE = [0.65, 0, 0.35, 1]
const OPEN_MS = 1750

/** Wax seal with a raised botanical emblem (original artwork). */
function WaxSeal({ className = '' }) {
  return (
    <svg viewBox="-60 -60 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="seal-wax" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#8a3552" />
          <stop offset="45%" stopColor="#62203a" />
          <stop offset="100%" stopColor="#3b0f1f" />
        </radialGradient>
        <filter id="seal-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2a0812" floodOpacity=".35" />
        </filter>
      </defs>
      {/* the poured wax: a slightly irregular disc */}
      <path
        d="M0-55c9 0 13 4 20 6 8 3 15 4 20 11 5 6 5 13 9 20 3 7 6 12 5 19-1 8-6 13-9 20-3 7-3 14-9 19-6 6-14 6-21 9-7 3-12 7-20 6-8 0-13-5-20-7-8-3-15-4-20-10-6-6-6-14-9-21-3-7-7-12-6-20 1-7 6-12 9-19 3-7 4-14 10-19 6-6 13-6 20-9 7-3 12-5 21-5z"
        fill="url(#seal-wax)"
        filter="url(#seal-shadow)"
      />
      {/* pressed rim */}
      <circle r="38" fill="none" stroke="#2c0914" strokeOpacity=".45" strokeWidth="2.2" />
      <circle r="38" fill="none" stroke="#c48a9e" strokeOpacity=".35" strokeWidth=".8" transform="translate(-.8 -.8)" />
      {/* emblem: a rose on a sprig, embossed (dark under-stroke, light top stroke) */}
      {[
        ['#2c0914', 0.5, 0.9],
        ['#d9a9ba', 0.55, -0.7],
      ].map(([stroke, opacity, shift]) => (
        <g key={stroke} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.5" strokeLinecap="round" transform={`translate(${shift} ${shift})`}>
          <path d="M0 22 C -2 10, 0 2, 0 -4" />
          <path d="M0 12 C -8 10, -16 4, -18 -4 C -10 -4, -3 4, 0 12Z" />
          <path d="M0 16 C 8 14, 16 8, 18 0 C 10 0, 3 8, 0 16Z" />
          <circle cy="-12" r="9" />
          <path d="M-4 -13 a4 4 0 1 1 8 1 a6 6 0 1 1 -11 1" />
          <path d="M-22 -26 l2 2 M22 -26 l-2 2 M-26 6 l2 0 M26 6 l-2 0" />
        </g>
      ))}
    </svg>
  )
}

/**
 * Artwork printed across both flaps (a frame and a fine arch outline). Each flap
 * shows its own half, so the design splits down the middle as it opens.
 */
function FlapArt({ side }) {
  return (
    <div className={`bg-paper absolute inset-y-0 w-[100vw] ${side === 'left' ? 'left-0' : 'right-0'}`}>
      <div className="bg-geometric absolute inset-0 opacity-60" />
      <div className="absolute inset-3 border border-haze sm:inset-5" />
      <div className="absolute inset-4.5 border border-bronze/25 sm:inset-6.5" />
      <svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-x-0 top-[6%] bottom-[6%] mx-auto h-[88%] w-full">
        <path d="M60 690 V250 C60 150 150 95 196 26 L200 20 L204 26 C250 95 340 150 340 250 V690" fill="none" stroke="var(--color-bronze)" strokeOpacity=".35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M72 690 V256 C72 162 158 108 200 44 C242 108 328 162 328 256 V690" fill="none" stroke="var(--color-haze)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export function Envelope({ titleLines, names, onOpen, onDone }) {
  const [phase, setPhase] = useState('closed') // closed → opening → gone
  const reduce = useReducedMotion()
  const button = useRef(null)

  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    button.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  const open = () => {
    if (phase !== 'closed') return
    onOpen?.()
    if (reduce) return setPhase('gone')
    setPhase('opening')
    setTimeout(() => setPhase('gone'), OPEN_MS)
  }
  const skip = () => {
    if (phase !== 'closed') return
    onOpen?.({ skipped: true })
    setPhase('gone')
  }

  const opening = phase === 'opening'
  const flap = (side) => ({
    className: `absolute inset-y-0 w-1/2 overflow-hidden ${side === 'left' ? 'left-0' : 'right-0'}`,
    style: { transformOrigin: side === 'left' ? 'left center' : 'right center', backfaceVisibility: 'hidden' },
    animate: opening ? { rotateY: side === 'left' ? 105 : -105, opacity: [1, 1, 0] } : { rotateY: 0, opacity: 1 },
    transition: { duration: 1.35, delay: 0.3, ease: EASE, opacity: { duration: 1.35, delay: 0.3, times: [0, 0.75, 1] } },
  })

  return (
    <AnimatePresence onExitComplete={onDone}>
      {phase !== 'gone' && (
        <motion.div
          key="cover"
          className="fixed inset-0 z-[70] overflow-hidden"
          style={{ perspective: 1800 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.3 : 0.5 }}
          role="dialog"
          aria-modal="true"
          aria-label="Undangan majlis"
        >
          {/* the two paper flaps */}
          <motion.div {...flap('left')}>
            <FlapArt side="left" />
            <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[rgb(52_31_41/0.07)] to-transparent" />
          </motion.div>
          <motion.div {...flap('right')}>
            <FlapArt side="right" />
            <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[rgb(52_31_41/0.05)] to-transparent" />
            <div className="absolute inset-y-0 left-0 w-px bg-haze" />
          </motion.div>

          {/* title, flowers, seal and button, centred over the seam */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <motion.div animate={{ opacity: opening ? 0 : 1, y: opening ? -10 : 0 }} transition={{ duration: 0.4 }} initial={{ opacity: 0, y: 10 }}>
              <p className="font-display text-[0.68rem] font-medium tracking-[0.42em] text-bronze-deep uppercase">Undangan</p>
              <p className="mx-auto mt-3 max-w-[17rem] font-display text-[0.82rem] leading-relaxed tracking-[0.16em] text-primary uppercase sm:max-w-none sm:text-[0.95rem]">
                {titleLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              {names && <p className="mt-3 font-serif text-[1.7rem] leading-tight font-medium text-primary italic sm:text-[2rem]">{names}</p>}
            </motion.div>

            <motion.div className="relative mt-5" animate={opening ? { opacity: 0, scale: 0.7 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <FloralGarland className="relative z-10 mx-auto -mb-9 w-56 sm:-mb-11 sm:w-64" />
              {/* the seal opens it too (for touch); keyboard users get the labelled button below */}
              <button
                type="button"
                onClick={open}
                className="pointer-events-auto relative mx-auto block size-28 cursor-pointer rounded-full transition-transform duration-500 hover:scale-[1.04] sm:size-32"
                aria-hidden="true"
                tabIndex={-1}
              >
                <WaxSeal className="size-full" />
              </button>
            </motion.div>

            <motion.div className="pointer-events-auto mt-8 flex flex-col items-center gap-4" animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.3 }}>
              <button ref={button} type="button" onClick={open} className="btn-primary min-w-56">
                <EightPointStar className="size-3.5" /> Buka Undangan
              </button>
              <button type="button" onClick={skip} className="font-display text-[0.68rem] tracking-[0.24em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline">
                Langkau
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
