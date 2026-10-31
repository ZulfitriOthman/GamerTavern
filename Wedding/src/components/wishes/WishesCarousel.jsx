import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WishCard } from './WishCard.jsx'

const AUTOPLAY_MS = 9000 // slow enough to read a full card before it moves on
const MAX_DOTS = 8 // beyond this the counter alone is clearer than a row of dots
const SWIPE_PX = 60
// Cards per slide: 3 on desktop, 2 on tablets, 1 on phones (largest first).
const PER_VIEW = [
  ['(min-width: 1024px)', 3],
  ['(min-width: 640px)', 2],
]
const EASE = [0.22, 1, 0.36, 1]
const range = (from, to) => (from === to ? `wish ${from}` : `wishes ${from}–${to}`)

function perViewNow() {
  if (typeof window === 'undefined') return 1
  return PER_VIEW.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 1
}

function usePerView() {
  const [perView, setPerView] = useState(perViewNow)
  useEffect(() => {
    const lists = PER_VIEW.map(([q]) => window.matchMedia(q))
    const update = () => setPerView(perViewNow())
    lists.forEach((l) => l.addEventListener('change', update))
    return () => lists.forEach((l) => l.removeEventListener('change', update))
  }, [])
  return perView
}

/** A stable "random" pose per wish (seeded by its id), so cards don't jump around on re-render. */
function scatter(id) {
  let h = 0
  for (const c of String(id)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0
  const r = (shift) => ((h >>> shift) & 0xff) / 255
  return { rotate: (r(0) - 0.5) * 3, y: Math.round(r(8) * 28), floatDelay: r(16) * 3 }
}

/**
 * Homepage wishes slideshow: a few cards at a time in a softly scattered
 * arrangement (phones get one straight card), with arrows, dots, swipe,
 * arrow keys and a slow autoplay that pauses on hover, keyboard focus,
 * off-screen, or when the guest presses pause. Reduced motion disables
 * autoplay, floating and sliding.
 */
export function WishesCarousel({ items }) {
  const reduce = useReducedMotion()
  const perView = usePerView()
  const pageCount = Math.max(1, Math.ceil(items.length / perView))
  const [[page, direction], setPage] = useState([0, 1])
  const current = Math.min(page, pageCount - 1) // stays valid when the screen size or wish count changes
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const rootRef = useRef(null)
  const inView = useInView(rootRef, { amount: 0.35 })

  const go = useCallback(
    (step) => setPage(([p]) => [(Math.min(p, pageCount - 1) + step + pageCount) % pageCount, step < 0 ? -1 : 1]),
    [pageCount],
  )
  const goTo = (target) => setPage([target, target < current ? -1 : 1])

  const autoplay = playing && !reduce && pageCount > 1
  useEffect(() => {
    if (!autoplay || hovered || focused || !inView) return
    const timer = setTimeout(() => go(1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [autoplay, hovered, focused, inView, current, go])

  // The last slide shows the final `perView` wishes, so no slide is left with a lone card.
  const pageStart = (p) => Math.max(0, Math.min(p * perView, items.length - perView))
  const start = pageStart(current)
  const visible = items.slice(start, start + perView)
  const scattered = perView > 1
  const focusIndex = visible.length === 3 ? 1 : -1 // the middle card of a full desktop slide

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return
    if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Guest wishes"
      onKeyDown={onKeyDown}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      // Only keyboard focus pauses; a mouse click on an arrow shouldn't stop autoplay for good.
      onFocus={(e) => e.target.matches(':focus-visible') && setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <div className="relative min-h-[18rem] px-1 py-6 sm:min-h-[24rem]" aria-live={autoplay ? 'off' : 'polite'}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={`${perView}-${current}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`Showing ${range(start + 1, start + visible.length)} of ${items.length}`}
            custom={direction}
            variants={{
              enter: (d) => ({ opacity: 0, x: reduce ? 0 : d * 48 }),
              center: { opacity: 1, x: 0 },
              exit: (d) => ({ opacity: 0, x: reduce ? 0 : d * -48 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0.2 : 0.55, ease: EASE }}
            drag={pageCount > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_e, { offset, velocity }) => {
              if (offset.x < -SWIPE_PX || velocity.x < -500) go(1)
              else if (offset.x > SWIPE_PX || velocity.x > 500) go(-1)
            }}
            className="flex cursor-grab items-start justify-center gap-6 active:cursor-grabbing lg:gap-8"
          >
            {visible.map((wish, i) => {
              const pose = scatter(wish.id)
              const isFocus = i === focusIndex
              return (
                <motion.div
                  key={wish.id}
                  className={`w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc((100%-4rem)/3)] ${isFocus ? 'z-10' : ''}`}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.08 + i * 0.1, ease: EASE }}
                  style={
                    scattered ? { rotate: isFocus ? 0 : pose.rotate, marginTop: isFocus ? 0 : pose.y, scale: isFocus ? 1.03 : 1 } : undefined
                  }
                >
                  <motion.div
                    animate={scattered && !reduce ? { y: [0, -6, 0] } : undefined}
                    transition={{ duration: 7, delay: pose.floatDelay, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <WishCard wish={wish} clamp reveal={false} className={isFocus ? 'shadow-lift ring-1 ring-gold/30' : ''} />
                  </motion.div>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <button type="button" className="btn-outline btn-sm size-11 rounded-full p-0" onClick={() => go(-1)} aria-label="Previous wishes">
              <ChevronLeft className="size-5" />
            </button>
            {pageCount <= MAX_DOTS ? (
              <div className="flex items-center gap-2">
                {Array.from({ length: pageCount }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goTo(p)}
                    aria-label={`Show ${range(pageStart(p) + 1, Math.min(pageStart(p) + perView, items.length))}`}
                    aria-current={p === current || undefined}
                    className="grid size-6 place-items-center"
                  >
                    <span className={`block h-2 rounded-full transition-all duration-500 ${p === current ? 'w-6 bg-gold' : 'w-2 bg-sand hover:bg-gold/60'}`} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="min-w-16 text-center text-sm tracking-[0.12em] text-muted tabular-nums" aria-hidden="true">
                {current + 1} / {pageCount}
              </p>
            )}
            <button type="button" className="btn-outline btn-sm size-11 rounded-full p-0" onClick={() => go(1)} aria-label="Next wishes">
              <ChevronRight className="size-5" />
            </button>
            {!reduce && (
              <button
                type="button"
                className="btn-ghost btn-sm size-11 rounded-full p-0 text-muted"
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
            )}
          </div>
          <p className="text-xs tracking-[0.12em] text-muted uppercase sm:hidden" aria-hidden="true">
            Swipe to read more
          </p>
        </div>
      )}
    </div>
  )
}
