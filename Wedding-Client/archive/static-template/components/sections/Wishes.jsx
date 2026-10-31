import { Quote } from 'lucide-react'
import { weddingData } from '../../data/weddingData.js'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

/** Example congratulations from weddingData.wishes (static — guests can't post yet). */
export function Wishes() {
  const { wishes } = weddingData
  return (
    <Section id="wishes" tone="ivory">
      <SectionTitle eyebrow="With love from" title="Wedding Wishes">
        <p>Kind words from the people who mean the most to us.</p>
      </SectionTitle>
      <div className="mx-auto mt-16 max-w-6xl columns-1 gap-6 sm:columns-2 lg:columns-3">
        {wishes.map((wish, i) => (
          <Reveal key={i} delay={(i % 3) * 0.08} className="mb-6 break-inside-avoid">
            <figure className="relative rounded-3xl border border-linen bg-white p-7 shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
              <Quote className="size-7 text-champagne" strokeWidth={1.2} aria-hidden="true" />
              <blockquote className="mt-3 font-serif text-xl leading-relaxed text-ink [overflow-wrap:anywhere]">{wish.message}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-linen pt-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream font-display text-sm text-gold-deep" aria-hidden="true">
                  {wish.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{wish.name}</span>
                  {wish.relationship && <span className="block text-xs tracking-[0.12em] text-muted uppercase">{wish.relationship}</span>}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
