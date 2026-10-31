import { ArrowRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLatestWishes } from '../../hooks/useLatestWishes.js'
import { friendlyError } from '../../lib/errors.js'
import { Notice, Spinner } from '../ui/Feedback.jsx'
import { Sprig } from '../ui/Ornaments.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { SectionHeading } from '../ui/SectionHeading.jsx'
import { WishesCarousel } from './WishesCarousel.jsx'

// The API's per-request maximum; the full guestbook lives on /wishes.
const HOME_WISHES = 24

/** Homepage "Wishes Wall": the latest published guest wishes as a slideshow. */
export function WishesWall({ enabled = true }) {
  const { items, loading, error, reload } = useLatestWishes(HOME_WISHES, { enabled })

  return (
    <section className="relative overflow-hidden py-20" aria-labelledby="wishes-wall-title">
      <Sprig className="pointer-events-none absolute top-10 -left-8 h-44 -rotate-[24deg] opacity-25" bloom={false} />
      <Sprig className="pointer-events-none absolute -right-6 bottom-6 h-48 rotate-[160deg] opacity-25" />
      <div className="container-wide">
        <SectionHeading eyebrow="Guestbook" title={<span id="wishes-wall-title">Words of Love &amp; Blessings</span>}>
          Beautiful wishes shared by our family and friends.
        </SectionHeading>

        <div className="mt-12">
          {loading ? (
            <div className="flex justify-center py-10" aria-live="polite">
              <Spinner className="size-6" label="Loading wishes" />
            </div>
          ) : error ? (
            <div className="mx-auto max-w-lg">
              <Notice tone="error" title="Wishes could not be loaded">
                {friendlyError(error)}{' '}
                <button type="button" className="underline" onClick={reload}>
                  Try again
                </button>
              </Notice>
            </div>
          ) : items.length === 0 ? (
            <Reveal className="card mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center">
              <Heart className="size-8 fill-rose/20 text-rose/60" strokeWidth={1.25} aria-hidden="true" />
              <p className="mt-4 font-serif text-2xl">Be the first to leave a wish</p>
              <p className="mt-2 text-base text-muted">Your blessings and kind words will appear here for everyone to see.</p>
              <Link to="/wishes" className="btn-outline mt-7">
                Write a wish
              </Link>
            </Reveal>
          ) : (
            <>
              <WishesCarousel items={items} />
              <div className="mt-10 text-center">
                <Link to="/wishes" className="btn-outline">
                  View all wishes <ArrowRight className="size-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
