import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useMusic } from '../../context/MusicContext.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { formatDate } from '../../lib/time.js'

const SEEN_KEY = 'wedding.envelopeSeen'

// Whether the envelope will greet this visit (lets the layout avoid a second music prompt).
// eslint-disable-next-line react/only-export-components
export function envelopeWillShow(content) {
  return Boolean(content.sections.envelope) && !hasSeen()
}

function hasSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Optional opening animation: a sealed envelope the guest taps to open.
 * Shown once per browser session; skippable; simplified for reduced motion.
 */
export function EnvelopeIntro() {
  const { content, settings } = useSite()
  const reduce = useReducedMotion()
  const music = useMusic()
  const [visible, setVisible] = useState(() => content.sections.envelope && !hasSeen())
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!visible) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  const close = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // private mode — the envelope will just show again next visit
    }
    setVisible(false)
  }

  const open = () => {
    if (opening) return
    // Start the music right here, inside the tap — the only moment browsers
    // (iPhone Safari included) allow sound. A remembered "no music" is respected.
    if (music && music.preference !== 'off') music.controller.enable()
    if (reduce) return close()
    setOpening(true)
    setTimeout(close, 1900)
  }

  const { partnerOne, partnerTwo } = content.couple

  return (
    <AnimatePresence>
      {visible && content.sections.envelope && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ivory bg-gradient-to-b from-ivory via-cream to-champagne px-6"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          role="dialog"
          aria-modal="true"
          aria-label="Wedding invitation"
        >
          <p className="eyebrow mb-8 text-center">You have received an invitation</p>

          <button
            type="button"
            onClick={open}
            className="group relative w-[min(86vw,420px)] cursor-pointer outline-none [perspective:1200px]"
            aria-label="Open the invitation"
            autoFocus
          >
            {/* Envelope body */}
            <div className="relative aspect-[1.45] w-full">
              {/* Letter that slides up */}
              <motion.div
                className="absolute inset-x-[7%] top-[8%] bottom-[6%] z-10 flex flex-col items-center justify-center rounded-md border border-champagne bg-ivory px-4 text-center shadow-soft"
                animate={opening ? { y: '-58%' } : { y: 0 }}
                transition={{ delay: 0.75, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="eyebrow text-[0.6875rem] tracking-[0.14em] sm:text-xs">{content.hero.eyebrow}</span>
                <span className="mt-2 font-script text-3xl leading-tight text-ink sm:text-4xl">
                  {partnerOne} <span className="text-gold-deep">&amp;</span> {partnerTwo}
                </span>
                {settings.wedding_date && (
                  <span className="mt-2 text-xs font-medium tracking-[0.12em] text-muted uppercase">{formatDate(settings.wedding_date, content.locale)}</span>
                )}
              </motion.div>

              {/* Front pocket */}
              <div
                className="absolute inset-0 z-20 rounded-lg bg-gradient-to-b from-champagne to-sand shadow-lift"
                style={{ clipPath: 'polygon(0 30%, 50% 66%, 100% 30%, 100% 100%, 0 100%)' }}
              />
              <div
                className="absolute inset-0 z-20 rounded-lg bg-gradient-to-tr from-sand/70 to-transparent"
                style={{ clipPath: 'polygon(0 30%, 50% 66%, 0 100%)' }}
              />
              {/* Flap */}
              <motion.div
                className="absolute inset-x-0 top-0 z-30 h-[66%] origin-top"
                style={{ transformStyle: 'preserve-3d' }}
                animate={opening ? { rotateX: 180, zIndex: 5 } : { rotateX: 0 }}
                transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
              >
                <div
                  className="h-full w-full rounded-t-lg bg-gradient-to-b from-sand to-champagne"
                  style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', backfaceVisibility: 'hidden' }}
                />
              </motion.div>
              {/* Wax seal */}
              <motion.div
                className="absolute top-[66%] left-1/2 z-40 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full bg-gradient-to-br from-gold to-gold-deep font-serif text-xl text-ivory shadow-lift ring-4 ring-gold/25 transition-transform group-hover:scale-105 sm:size-20 sm:text-2xl"
                animate={opening ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                {partnerOne.charAt(0)}
                <span className="font-script text-base">&amp;</span>
                {partnerTwo.charAt(0)}
              </motion.div>
            </div>
          </button>

          <p className="mt-10 text-base font-medium tracking-[0.14em] text-muted uppercase">{opening ? 'Welcome' : 'Tap the seal to open'}</p>
          {!opening && (
            <button
              type="button"
              onClick={() => {
                music?.controller.disable()
                close()
              }}
              className="btn-ghost btn-sm mt-4"
              data-music-control
            >
              Enter without music
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
