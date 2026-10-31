import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { Lightbox } from './Lightbox.jsx'

/** Grid tile preview: photo/GIF thumbnail (GIFs stay animated), or a video poster. */
function TilePreview({ item, index }) {
  const sizing = { width: item.width || undefined, height: item.height || undefined }
  if (item.media_type === 'video') {
    return (
      <>
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.caption || ''} loading="lazy" decoding="async" {...sizing} className="h-auto w-full transition duration-700 group-hover:scale-[1.04]" />
        ) : (
          // No poster: show the first frame. preload="metadata" fetches only a small part of the file.
          <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" {...sizing} className="pointer-events-none h-auto w-full bg-ink/80" aria-hidden="true" />
        )}
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <span className="grid size-12 place-items-center rounded-full bg-ink/55 text-ivory shadow-lift backdrop-blur-sm transition group-hover:scale-110">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
      </>
    )
  }
  return (
    <img
      src={item.thumbUrl}
      alt={item.caption || ''}
      loading={index < 4 ? 'eager' : 'lazy'}
      decoding="async"
      {...sizing}
      className="h-auto w-full transition duration-700 group-hover:scale-[1.04]"
    />
  )
}

const label = (item, i) => {
  const kind = item.media_type === 'video' ? 'video' : item.media_type === 'gif' ? 'GIF' : 'photo'
  return item.caption ? `Open ${kind}: ${item.caption}` : `Open ${kind} ${i + 1}`
}

/** Masonry grid of photos, GIFs and videos that opens a lightbox on tap. */
export function PhotoGrid({ photos }) {
  const [active, setActive] = useState(null)
  const reduce = useReducedMotion()

  return (
    <>
      <ul className="masonry">
        {photos.map((photo, i) => (
          <motion.li
            key={photo.id}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: (i % 4) * 0.05 }}
          >
            <button type="button" onClick={() => setActive(i)} className="group relative block w-full overflow-hidden rounded-2xl bg-cream shadow-soft" aria-label={label(photo, i)}>
              <TilePreview item={photo} index={i} />
              {photo.media_type === 'gif' && (
                <span className="absolute top-2 left-2 rounded-full bg-ink/60 px-2 py-0.5 text-xs font-semibold tracking-wide text-ivory" aria-hidden="true">
                  GIF
                </span>
              )}
              {(photo.caption || photo.uploader_name) && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pt-8 pb-2.5 text-left text-sm text-ivory opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {photo.caption || `Shared by ${photo.uploader_name}`}
                </span>
              )}
            </button>
          </motion.li>
        ))}
      </ul>
      <Lightbox photos={photos} index={active} onChange={setActive} onClose={() => setActive(null)} />
    </>
  )
}
