import { Camera, Images } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Lightbox } from '../components/gallery/Lightbox.jsx'
import { PhotoGrid, PhotoGridSkeleton } from '../components/gallery/PhotoGrid.jsx'
import { EmptyState, LoadError } from '../components/ui/Feedback.jsx'
import { PageHeader } from '../components/ui/Section.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { getPhotos } from '../services/publicService.js'

export default function GalleryPage() {
  const { albums, content, settings, ready } = useSite()
  const photos = useAsync(() => getPhotos(500), [])
  const [album, setAlbum] = useState('all')
  const [index, setIndex] = useState(null)

  const all = photos.data ?? []
  const tabs = albums.filter((a) => all.some((p) => p.album_id === a.id))
  const shown = album === 'all' ? all : all.filter((p) => p.album_id === album)

  if (ready && content.sections.gallery === false) return <Navigate to="/" replace />

  return (
    <>
      <PageHeader eyebrow="Gallery" title="Moments to treasure">
        <p>Photographs of us, our families and the celebration — including the ones you shared.</p>
      </PageHeader>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl">
          {tabs.length > 0 && (
            <div className="scrollbar-none -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:justify-center" role="tablist" aria-label="Albums">
              {[{ id: 'all', title: 'All' }, ...tabs].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={album === a.id}
                  onClick={() => setAlbum(a.id)}
                  className={`shrink-0 rounded-full border px-5 py-2 text-xs tracking-[0.16em] uppercase transition ${
                    album === a.id ? 'border-ink bg-ink text-ivory' : 'border-champagne bg-white/60 text-muted hover:border-gold hover:text-ink'
                  }`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          )}

          {photos.error ? (
            <div className="mx-auto max-w-lg">
              <LoadError message={photos.error} onRetry={photos.reload} />
            </div>
          ) : photos.loading && !photos.data ? (
            <PhotoGridSkeleton />
          ) : shown.length === 0 ? (
            <EmptyState icon={Images} title="Photos are on their way">
              The gallery will fill up with memories soon.
            </EmptyState>
          ) : (
            <>
              {album !== 'all' && albums.find((a) => a.id === album)?.description && (
                <p className="mb-6 text-center font-serif text-lg text-muted italic">{albums.find((a) => a.id === album).description}</p>
              )}
              <PhotoGrid photos={shown} onOpen={setIndex} />
            </>
          )}

          {settings.photo_uploads_enabled && (
            <div className="mt-14 text-center">
              <Link to="/share" className="btn-primary">
                <Camera className="size-4" aria-hidden="true" /> Share your photos
              </Link>
            </div>
          )}
        </div>
      </section>
      <Lightbox photos={shown} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </>
  )
}
