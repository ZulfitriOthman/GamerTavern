import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { mediaUrl } from '../../lib/api.js'

/** Masonry grid (CSS columns). Width/height reserve space so nothing jumps while loading. */
export function PhotoGrid({ photos, onOpen, columns = 'columns-2 sm:columns-3 lg:columns-4' }) {
  return (
    <ul className={`${columns} gap-3 sm:gap-4`}>
      {photos.map((p, i) => {
        const thumb = mediaUrl(p.thumbUrl || p.posterUrl)
        const ratio = p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5'
        return (
          <motion.li
            key={p.id}
            className="mb-3 break-inside-avoid sm:mb-4"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ duration: 0.6, delay: (i % 4) * 0.06 }}
          >
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="group relative block w-full overflow-hidden rounded-2xl bg-linen shadow-soft ring-1 ring-champagne/60 transition hover:shadow-lift"
              style={{ aspectRatio: ratio }}
              aria-label={p.caption ? `Open photo: ${p.caption}` : `Open ${p.media_type === 'video' ? 'video' : 'photo'} ${i + 1}`}
            >
              {thumb ? (
                <img src={thumb} alt={p.caption || ''} loading="lazy" decoding="async" className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              ) : (
                <video src={`${mediaUrl(p.url)}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" aria-hidden="true" />
              )}
              {p.media_type === 'video' && (
                <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-ink/55 text-white backdrop-blur" aria-hidden="true">
                  <Play className="size-3.5 fill-current" />
                </span>
              )}
              {(p.caption || p.uploader_name) && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pt-8 pb-2.5 text-left text-xs text-ivory opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {p.caption && <span className="line-clamp-2 block">{p.caption}</span>}
                  {p.uploader_name && <span className="block text-ivory/75">by {p.uploader_name}</span>}
                </span>
              )}
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}

export function PhotoGridSkeleton({ count = 8 }) {
  const heights = ['aspect-[4/5]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/3]']
  return (
    <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={`skeleton mb-3 break-inside-avoid sm:mb-4 ${heights[i % heights.length]}`} />
      ))}
    </ul>
  )
}
