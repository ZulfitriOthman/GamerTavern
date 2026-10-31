// Invitation envelope shown once per visit on the home page. Tapping the wax
// seal folds the flap back, slides the card up and fades into the site.
// Reduced-motion visitors get a simple fade; "Skip" is always available.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

export function Envelope({ names, monogram, guestName, eyebrow, onDone }) {
  const [phase, setPhase] = useState('closed') // closed → opening → leaving
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
    if (reduce) return setPhase('leaving')
    setPhase('opening')
    setTimeout(() => setPhase('leaving'), 2100)
  }

  const opening = phase !== 'closed'

  return (
    <AnimatePresence onExitComplete={onDone}>
      {phase !== 'leaving' && (
        <motion.div
          key="envelope"
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-ivory px-6"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: reduce ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Wedding invitation"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(700px 420px at 50% 30%, rgb(230 214 187 / 0.55), transparent 70%), radial-gradient(600px 400px at 50% 100%, rgb(223 229 214 / 0.7), transparent 70%)',
            }}
            aria-hidden="true"
          />

          <motion.p className="eyebrow relative mb-8 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: opening ? 0 : 1, y: 0 }} transition={{ delay: 0.2 }}>
            {guestName ? `Dear ${guestName}` : eyebrow || 'You are invited'}
          </motion.p>

          {/* Envelope */}
          <motion.div
            className="relative aspect-[1.45] w-[min(86vw,440px)]"
            style={{ perspective: 1200 }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: opening ? 60 : 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: opening ? 0.5 : 0 }}
          >
            {/* back */}
            <div className="absolute inset-0 rounded-md bg-gradient-to-b from-champagne to-sand shadow-lift" />

            {/* letter */}
            <motion.div
              className="absolute inset-x-[6%] top-[8%] bottom-[6%] flex flex-col items-center justify-center rounded-sm border border-champagne bg-ivory px-4 text-center shadow-soft"
              animate={{ y: opening ? '-62%' : 0 }}
              transition={{ duration: 1, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              {names.length > 28 ? (
                // A majlis title rather than the couple's names: small engraved capitals.
                <p className="font-serif text-[0.8rem] leading-snug tracking-[0.14em] text-balance text-gold-deep uppercase sm:text-base">{names}</p>
              ) : (
                <>
                  <p className="eyebrow text-[0.6rem]">The wedding of</p>
                  <p className="mt-1 font-script text-3xl leading-tight text-gold-deep sm:text-4xl">{names}</p>
                </>
              )}
            </motion.div>

            {/* front pocket */}
            <div className="envelope-pocket absolute inset-0 rounded-md bg-gradient-to-b from-linen to-champagne" />
            <div className="pointer-events-none absolute inset-0 rounded-md border border-sand/60" />

            {/* flap */}
            <motion.div
              className="envelope-flap absolute inset-x-0 top-0 h-[56%] bg-gradient-to-b from-sand to-champagne"
              style={{ zIndex: opening ? 0 : 3 }}
              animate={{ rotateX: opening ? 180 : 0 }}
              transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
            />

            {/* wax seal */}
            <motion.button
              ref={button}
              type="button"
              onClick={open}
              className="absolute top-[56%] left-1/2 z-10 grid size-[4.5rem] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full font-serif text-xl tracking-wider text-ivory shadow-lift sm:size-20"
              style={{ background: 'radial-gradient(circle at 35% 30%, #c9a46a, #9a7a45 60%, #7d6236)' }}
              aria-label="Open the invitation"
              animate={opening ? { scale: 0, opacity: 0 } : { scale: [1, 1.05, 1] }}
              transition={opening ? { duration: 0.3 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="absolute inset-1.5 rounded-full border border-ivory/40" aria-hidden="true" />
              {monogram}
            </motion.button>
          </motion.div>

          <motion.div className="relative mt-10 flex flex-col items-center gap-4" animate={{ opacity: opening ? 0 : 1 }}>
            <p className="font-serif text-lg text-muted italic">Tap the seal to open</p>
            <button type="button" onClick={() => setPhase('leaving')} className="text-xs tracking-[0.2em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline">
              Skip
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
