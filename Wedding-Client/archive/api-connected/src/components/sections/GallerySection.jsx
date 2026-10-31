import { ArrowRight, Camera, Images } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { labels } from '../../lib/labels.js'
import { getPhotos } from '../../services/publicService.js'
import { Lightbox } from '../gallery/Lightbox.jsx'
import { PhotoGrid, PhotoGridSkeleton } from '../gallery/PhotoGrid.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

const PREVIEW = 12

/** Home-page gallery: the latest published photos, with a link to the full gallery. */
export function GallerySection() {
  const { locale, settings } = useSite()
  const photos = useAsync(() => getPhotos(PREVIEW + 1), [])
  const [index, setIndex] = useState(null)
  const items = (photos.data ?? []).slice(0, PREVIEW)
  const more = (photos.data?.length ?? 0) > PREVIEW

  return (
    <Section id="gallery" tone="ivory">
      <SectionTitle kicker={labels(locale).galleryKicker} title="Gallery" />
      <div className="mx-auto mt-14 max-w-6xl">
        {photos.loading && !photos.data ? (
          <PhotoGridSkeleton count={8} />
        ) : items.length ? (
          <PhotoGrid photos={items} onOpen={setIndex} columns="columns-2 md:columns-3" />
        ) : (
          <Reveal className="mx-auto grid max-w-3xl grid-cols-3 gap-3 sm:gap-4" aria-label="The gallery is empty for now">
            {['aspect-[3/4]', 'aspect-[3/4] translate-y-6', 'aspect-[3/4]'].map((cls, i) => (
              <div key={i} className={`flex items-center justify-center rounded-2xl border border-dashed border-sand bg-beige ${cls}`} aria-hidden="true">
                <Images className="size-7 text-sand" strokeWidth={1.2} />
              </div>
            ))}
            <p className="col-span-3 mt-10 text-center font-serif text-xl text-muted italic">Our photographs will be shared here after the celebration.</p>
          </Reveal>
        )}
        <Reveal className="mt-12 flex flex-wrap justify-center gap-3">
          {(items.length > 0 || more) && (
            <Link to="/gallery" className="btn-outline">
              View the full gallery <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          {settings.photo_uploads_enabled && (
            <Link to="/share" className="btn-primary">
              <Camera className="size-4" aria-hidden="true" /> Share your photos
            </Link>
          )}
        </Reveal>
      </div>
      <Lightbox photos={items} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </Section>
  )
}
