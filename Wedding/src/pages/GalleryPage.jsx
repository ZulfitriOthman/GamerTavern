import { Camera, Images } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoGrid } from '../components/gallery/PhotoGrid.jsx'
import { EmptyState, LoadingBlock, Notice } from '../components/ui/Feedback.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { friendlyError } from '../lib/errors.js'
import { useAsync } from '../hooks/useAsync.js'
import { listApprovedPhotos } from '../services/photoService.js'

export function GalleryPage() {
  const { albums, settings, connected } = useSite()
  const { data, error, loading, reload } = useAsync(() => listApprovedPhotos(), [])
  const [album, setAlbum] = useState('all')

  // New guest uploads are published instantly: refresh quietly while the page is
  // visible and whenever the guest comes back to it. Filters are kept, and the
  // existing photos stay on screen while new data loads.
  useEffect(() => {
    const refreshIfVisible = () => document.visibilityState === 'visible' && reload()
    const timer = setInterval(refreshIfVisible, 60_000)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [reload])

  const photos = useMemo(() => (data ?? []).filter((p) => album === 'all' || p.album_id === album), [data, album])
  const usedAlbums = useMemo(() => albums.filter((a) => (data ?? []).some((p) => p.album_id === a.id)), [albums, data])

  return (
    <PageShell eyebrow="Moments" title="Wedding Gallery" intro="Our favourite photos and videos — and yours.">
      {usedAlbums.length > 1 && (
        <div className="-mx-5 mb-10 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="tablist" aria-label="Albums">
          {[{ id: 'all', title: 'All' }, ...usedAlbums].map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={album === a.id}
              onClick={() => setAlbum(a.id)}
              className={`chip shrink-0 ${album === a.id ? 'chip-active' : ''}`}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading photos…" />
      ) : error ? (
        <div className="mx-auto max-w-lg">
          <Notice tone="error" title="The gallery could not be loaded">
            {friendlyError(error)}{' '}
            <button type="button" className="underline" onClick={reload}>
              Try again
            </button>
          </Notice>
        </div>
      ) : photos.length === 0 ? (
        <EmptyState icon={Images} title="Photos coming soon">
          {connected ? 'Photos and videos will appear here as soon as they are shared.' : 'The gallery will appear once the website is connected.'}
        </EmptyState>
      ) : (
        <PhotoGrid photos={photos} />
      )}

      {settings.photo_uploads_enabled && (
        <div className="mt-16 text-center">
          <Link to="/share" className="btn-gold">
            <Camera className="size-4" /> Share photos &amp; videos
          </Link>
        </div>
      )}
    </PageShell>
  )
}
