import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMusic } from '../../context/MusicContext.jsx'

export function Lightbox({ photos, index, onChange, onClose }) {
  const open = index !== null && index >= 0 && index < photos.length
  const photo = open ? photos[index] : null
  const isVideo = photo?.media_type === 'video'
  const closeRef = useRef(null)
  const music = useMusic()
  const controller = music?.controller

  // Background music steps aside while a video plays, and returns when it stops —
  // including when the viewer is closed or moves on mid-video (no pause event then).
  // resumeAfterMedia() never restarts music the guest paused themselves.
  useEffect(() => {
    if (!controller || !isVideo) return
    return () => controller.resumeAfterMedia()
  }, [controller, isVideo, photo?.id])

  const go = useCallback((delta) => onChange((index + delta + photos.length) % photos.length), [index, photos.length, onChange])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      // When the video player has focus, arrow keys seek the video instead.
      if (e.target instanceof HTMLMediaElement) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, go, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col bg-ink/95 text-ivory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm tracking-[0.12em] uppercase sm:px-6">
            <span aria-live="polite">
              {index + 1} / {photos.length}
            </span>
            <button ref={closeRef} type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
              <X className="size-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <AnimatePresence mode="wait" initial={false}>
              {isVideo ? (
                // Native controls: play/pause, volume, fullscreen, mobile playback.
                // Never autoplays; changing item unmounts it, so only one video ever plays.
                <motion.video
                  key={photo.id}
                  src={photo.url}
                  poster={photo.posterUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onPlay={() => controller?.pauseForMedia()}
                  onPause={() => controller?.resumeAfterMedia()}
                  onEnded={() => controller?.resumeAfterMedia()}
                  className="max-h-full max-w-full rounded-lg bg-black"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  aria-label={photo.caption || 'Wedding video'}
                />
              ) : (
                <motion.img
                  key={photo.id}
                  src={photo.url || photo.thumbUrl}
                  alt={photo.caption || (photo.media_type === 'gif' ? 'Wedding GIF' : 'Wedding photo')}
                  className="max-h-full max-w-full touch-pan-y rounded-lg object-contain select-none"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  drag={photos.length > 1 ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) go(1)
                    else if (info.offset.x > 60) go(-1)
                  }}
                />
              )}
            </AnimatePresence>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className={`absolute left-2 z-10 size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid ${isVideo ? 'grid' : 'hidden'}`} aria-label="Previous">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => go(1)} className={`absolute right-2 z-10 size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid ${isVideo ? 'grid' : 'hidden'}`} aria-label="Next">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          <div className="min-h-20 px-6 py-4 text-center">
            {photo.caption && <p className="font-serif text-lg italic">{photo.caption}</p>}
            {photo.uploader_name && <p className="mt-1 text-sm tracking-[0.1em] text-ivory/85 uppercase">Shared by {photo.uploader_name}</p>}
            {photos.length > 1 && !isVideo && <p className="mt-2 text-xs text-ivory/75 sm:hidden">Swipe to browse</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
