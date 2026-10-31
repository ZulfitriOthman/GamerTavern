import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { mediaUrl } from '../../lib/api.js'

/** Full-screen viewer: arrows / Escape on keyboards, swipe on phones. */
export function Lightbox({ photos, index, onIndex, onClose }) {
  const open = index !== null && index >= 0 && index < photos.length
  const touch = useRef(null)
  const closeBtn = useRef(null)
  const photo = open ? photos[index] : null
  const count = photos.length

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % count)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, index, count, onIndex, onClose])

  // Preload neighbours for instant paging.
  useEffect(() => {
    if (!open) return
    for (const i of [index + 1, index - 1]) {
      const p = photos[(i + count) % count]
      if (p?.media_type !== 'video') new Image().src = mediaUrl(p?.url)
    }
  }, [open, index, count, photos])

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
          className="fixed inset-0 z-[80] flex flex-col bg-ink/95 text-ivory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
            <span className="text-xs tracking-[0.2em] text-ivory/70 tabular-nums">
              {index + 1} / {count}
            </span>
            <button ref={closeBtn} type="button" onClick={onClose} className="rounded-full p-2.5 hover:bg-white/10" aria-label="Close">
              <X className="size-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={photo.id} className="flex max-h-full max-w-full items-center justify-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {photo.media_type === 'video' ? (
                  <video
                    src={mediaUrl(photo.url)}
                    poster={mediaUrl(photo.posterUrl) || undefined}
                    controls
                    playsInline
                    autoPlay
                    className="max-h-[calc(100dvh-10rem)] max-w-full rounded-lg"
                  />
                ) : (
                  <img src={mediaUrl(photo.url)} alt={photo.caption || ''} className="max-h-[calc(100dvh-10rem)] max-w-full rounded-lg object-contain shadow-2xl" />
                )}
              </motion.div>
            </AnimatePresence>

            {count > 1 && (
              <>
                <button type="button" onClick={() => onIndex((index - 1 + count) % count)} className="absolute left-2 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Previous">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => onIndex((index + 1) % count)} className="absolute right-2 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Next">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          <div className="min-h-16 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
            {photo.caption && <p className="font-serif text-lg italic">{photo.caption}</p>}
            {photo.uploader_name && <p className="mt-1 text-xs tracking-[0.16em] text-ivory/60 uppercase">Shared by {photo.uploader_name}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
