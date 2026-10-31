import { AnimatePresence, motion } from 'motion/react'
import { Music, Pause, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useMusic } from '../context/MusicContext.jsx'

/**
 * Floating background-music control (bottom-right) plus, when the envelope is not
 * shown, a gentle first-visit choice: "Enter with Music" / "Continue Without Music".
 * Playback itself lives in MusicProvider, so this can unmount freely.
 */
export function BackgroundMusic({ offerChoice }) {
  const music = useMusic()
  const [volumeOpen, setVolumeOpen] = useState(false)
  const panelRef = useRef(null)
  const sliderId = useId()

  // Close the volume panel on Escape or a tap elsewhere.
  useEffect(() => {
    if (!volumeOpen) return
    const onKey = (e) => e.key === 'Escape' && setVolumeOpen(false)
    const onDown = (e) => !panelRef.current?.contains(e.target) && setVolumeOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [volumeOpen])

  if (!music) return null
  const { controller, status, preference, volume, volumeAdjustable } = music
  const playing = status === 'playing'
  // Only while the browser is holding back autoplay and the guest has not chosen yet.
  const askFirst = offerChoice && preference === null && status === 'blocked'
  const label = playing ? 'Pause background music' : 'Play background music'

  return (
    <div ref={panelRef} data-music-control className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 z-50">
      <AnimatePresence>
        {askFirst && (
          <motion.div
            role="region"
            aria-label="Background music"
            className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gold/30 bg-ivory/95 p-4 text-center shadow-lift backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4 }}
          >
            <p className="font-serif text-lg italic text-ink">A little music for the occasion?</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" onClick={() => controller.enable()} className="btn-gold btn-sm">
                <Music className="size-4" aria-hidden="true" /> Enter with Music
              </button>
              <button type="button" onClick={() => controller.disable()} className="btn-ghost btn-sm">
                Continue Without Music
              </button>
            </div>
          </motion.div>
        )}

        {volumeOpen && volumeAdjustable && (
          <motion.div
            className="flex items-center gap-3 rounded-full border border-gold/30 bg-ivory/95 px-4 py-2 shadow-soft backdrop-blur"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            <label htmlFor={sliderId} className="text-xs font-medium tracking-[0.1em] text-muted uppercase">
              Volume
            </label>
            <input
              id={sliderId}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => controller.setVolume(e.target.value)}
              aria-valuetext={`${Math.round(volume * 100)}%`}
              className="w-28 accent-gold"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        {playing && volumeAdjustable && (
          <button
            type="button"
            onClick={() => setVolumeOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-full border border-gold/30 bg-ivory/90 text-gold-deep shadow-soft backdrop-blur transition hover:bg-champagne focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            aria-label="Adjust music volume"
            aria-expanded={volumeOpen}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => controller.toggle()}
          className="relative grid size-12 place-items-center rounded-full border border-gold/50 bg-gradient-to-br from-ivory to-champagne text-gold-deep shadow-lift transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ivory focus-visible:outline-none"
          aria-label={label}
          aria-pressed={playing}
          title={status === 'error' ? 'Music could not be loaded' : label}
        >
          {playing && <span className="absolute inset-0 animate-ping rounded-full border border-gold/40 [animation-duration:2.4s] motion-reduce:hidden" aria-hidden="true" />}
          {playing ? <Pause className="size-5" aria-hidden="true" /> : <Music className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
