import { MessageCircleHeart } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, LoadError, Spinner } from '../components/ui/Feedback.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageHeader } from '../components/ui/Section.jsx'
import { WishCard } from '../components/wishes/WishCard.jsx'
import { WishForm } from '../components/wishes/WishForm.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { errorMessage } from '../lib/api.js'
import { getWishes } from '../services/publicService.js'

export default function WishesPage() {
  const first = useAsync(() => getWishes(0), [])
  const [more, setMore] = useState({ items: [], page: 0, hasMore: null, loading: false, error: '' })
  const [added, setAdded] = useState([])

  const items = [...added, ...(first.data?.items ?? []), ...more.items].filter((w, i, all) => all.findIndex((x) => x.id === w.id) === i)
  const hasMore = more.hasMore ?? first.data?.hasMore

  const loadMore = async () => {
    setMore((m) => ({ ...m, loading: true, error: '' }))
    try {
      const page = more.page + 1
      const res = await getWishes(page)
      setMore((m) => ({ items: [...m.items, ...res.items], page, hasMore: res.hasMore, loading: false, error: '' }))
    } catch (error) {
      setMore((m) => ({ ...m, loading: false, error: errorMessage(error) }))
    }
  }

  return (
    <>
      <PageHeader eyebrow="Guestbook" title="Leave your wishes">
        <p>Share a blessing, a prayer or a few kind words for our new journey together.</p>
      </PageHeader>

      <section className="px-4">
        <Reveal className="paper mx-auto max-w-2xl p-5 sm:p-8">
          <WishForm onPublished={(item) => setAdded((a) => [item, ...a])} />
        </Reveal>
      </section>

      <section className="px-4 pt-16 pb-6" aria-label="Wishes from our guests">
        <div className="mx-auto max-w-6xl">
          {first.error ? (
            <div className="mx-auto max-w-lg">
              <LoadError message={first.error} onRetry={first.reload} />
            </div>
          ) : first.loading && !first.data ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-44" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={MessageCircleHeart} title="Be the first to leave a wish" />
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {items.map((wish, i) => (
                <Reveal key={wish.id} delay={(i % 3) * 0.06} className="mb-5 break-inside-avoid">
                  <WishCard wish={wish} />
                </Reveal>
              ))}
            </div>
          )}

          {more.error && <LoadError message={more.error} onRetry={loadMore} />}
          {hasMore && !first.loading && (
            <div className="mt-8 text-center">
              <button type="button" className="btn-outline" onClick={loadMore} disabled={more.loading}>
                {more.loading ? <Spinner label="Loading" /> : 'Show more wishes'}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
