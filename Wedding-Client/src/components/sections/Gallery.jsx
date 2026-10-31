import { Expand } from 'lucide-react'
import { useState } from 'react'
import { weddingData } from '../../data/weddingData.js'
import { Lightbox } from '../gallery/Lightbox.jsx'
import { PhotoPlaceholder } from '../ui/PhotoPlaceholder.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

/** Masonry gallery (2 columns on phones, 3 on larger screens) with a lightbox. */
export function Gallery() {
  const { photos, note } = weddingData.gallery
  const [index, setIndex] = useState(null)
  return (
    <Section id="galeri" tone="ivory">
      <SectionTitle eyebrow="Kenangan" title="Galeri">
        {note && <p>{note}</p>}
      </SectionTitle>
      <ul className="mx-auto mt-16 max-w-6xl columns-2 gap-3 sm:gap-5 md:columns-3">
        {photos.map((photo, i) => (
          <Reveal as="li" key={photo.src} delay={(i % 3) * 0.08} className="mb-3 break-inside-avoid sm:mb-5">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block w-full overflow-hidden rounded-sm border border-line bg-white p-1.5 shadow-soft transition hover:shadow-lift"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              aria-label={`Buka gambar: ${photo.caption || photo.alt}`}
            >
              <SmartImage
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="size-full rounded-[1px] object-cover transition duration-700 group-hover:scale-[1.03]"
                fallback={<PhotoPlaceholder label={photo.caption} tone={i} rounded="rounded-[1px]" className="size-full transition duration-700 group-hover:scale-[1.03]" />}
              />
              <span className="absolute inset-1.5 flex items-end justify-between bg-gradient-to-t from-night/60 via-transparent to-transparent p-4 text-left text-ivory opacity-0 transition duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="font-serif text-lg italic">{photo.caption}</span>
                <Expand className="size-4 shrink-0" aria-hidden="true" />
              </span>
            </button>
          </Reveal>
        ))}
      </ul>
      <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </Section>
  )
}
