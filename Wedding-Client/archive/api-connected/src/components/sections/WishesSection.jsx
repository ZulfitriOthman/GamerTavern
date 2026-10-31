import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { labels } from '../../lib/labels.js'
import { getWishes } from '../../services/publicService.js'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { WishCard } from '../wishes/WishCard.jsx'
import { WishForm } from '../wishes/WishForm.jsx'

/** Guestbook on the home page: the form beside the latest wishes. */
export function WishesSection() {
  const { locale } = useSite()
  const latest = useAsync(() => getWishes(0, 4), [])
  const [added, setAdded] = useState([])
  const items = [...added, ...(latest.data?.items ?? [])].filter((w, i, all) => all.findIndex((x) => x.id === w.id) === i).slice(0, 4)

  return (
    <Section id="wishes" tone="ivory">
      <SectionTitle kicker={labels(locale).wishesKicker} title="Leave Your Wishes">
        <p>A blessing, a prayer or a few kind words — we will treasure every one.</p>
      </SectionTitle>
      <div className="mx-auto mt-14 grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <Reveal className="rounded-[1.5rem] border border-linen bg-white p-5 shadow-lift sm:p-9">
          <WishForm onPublished={(item) => setAdded((a) => [item, ...a])} />
        </Reveal>
        <div>
          {items.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {items.map((w, i) => (
                <Reveal key={w.id} delay={i * 0.06}>
                  <WishCard wish={w} />
                </Reveal>
              ))}
            </div>
          ) : (
            !latest.loading && (
              <p className="py-10 text-center font-serif text-xl text-muted italic lg:text-left">Be the first to leave a wish.</p>
            )
          )}
          {items.length > 0 && (
            <Reveal className="mt-8 text-center lg:text-left">
              <Link to="/wishes" className="btn-outline">
                Read all wishes <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Reveal>
          )}
        </div>
      </div>
    </Section>
  )
}
