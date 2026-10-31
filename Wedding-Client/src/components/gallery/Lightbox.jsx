import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PhotoPlaceholder } from '../ui/PhotoPlaceholder.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

/** Full-screen viewer: arrows / Escape on keyboards, swipe on phones. Focus returns on close. */
export function Lightbox({ photos, index, onIndex, onClose }) {
  const open = index !== null && index >= 0 && index < photos.length
  const touch = useRef(null)
  const closeBtn = useRef(null)
  const photo = open ? photos[index] : null
  const count = photos.length

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % count)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, index, count, onIndex, onClose])

  // Lock scrolling and restore focus once per open/close (not on every photo change).
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  const onTouchStart = (e) => (touch.current = e.touches[0].clientX)
  const onTouchEnd = (e) => {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (Math.abs(dx) > 50) onIndex(dx < 0 ? (index + 1) % count : (index - 1 + count) % count)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col bg-night/95 text-ivory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Paparan gambar"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
            <span className="text-xs tracking-[0.2em] text-ivory/70 tabular-nums" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button ref={closeBtn} type="button" onClick={onClose} className="rounded-full p-2.5 hover:bg-white/10" aria-label="Tutup">
              <X className="size-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={photo.src} className="flex max-h-full w-full max-w-4xl items-center justify-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <SmartImage
                  src={photo.src}
                  alt={photo.alt}
                  className="max-h-[calc(100dvh-10rem)] max-w-full rounded-lg object-contain shadow-2xl"
                  fallback={
                    <PhotoPlaceholder
                      label={photo.caption}
                      tone={index}
                      className="max-h-[calc(100dvh-10rem)] w-full max-w-lg"
                      rounded="rounded-lg"
                      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                    />
                  }
                />
              </motion.div>
            </AnimatePresence>

            {count > 1 && (
              <>
                <button type="button" onClick={() => onIndex((index - 1 + count) % count)} className="absolute left-3 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Gambar sebelumnya">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => onIndex((index + 1) % count)} className="absolute right-3 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Gambar seterusnya">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          <div className="min-h-16 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
            {photo.caption && <p className="font-serif text-xl italic">{photo.caption}</p>}
            {count > 1 && <p className="mt-1 text-[0.65rem] tracking-[0.2em] text-ivory/50 uppercase sm:hidden">Leret untuk gambar lain</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
