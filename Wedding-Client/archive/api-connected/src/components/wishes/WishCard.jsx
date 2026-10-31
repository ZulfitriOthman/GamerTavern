import { Quote } from 'lucide-react'
import { timeAgo } from '../../lib/time.js'

/** Guest text is rendered as plain React text — never as HTML. */
export function WishCard({ wish }) {
  return (
    <figure className="card relative h-full break-inside-avoid p-6 transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      <Quote className="absolute top-5 right-5 size-7 text-champagne" strokeWidth={1.2} aria-hidden="true" />
      <blockquote className="pr-6 font-serif text-lg leading-relaxed whitespace-pre-line text-ink [overflow-wrap:anywhere]">{wish.message}</blockquote>
      <figcaption className="mt-5 flex items-end justify-between gap-3 border-t border-champagne/60 pt-4">
        <span className="min-w-0">
          <span className="block truncate font-medium text-sage-deep">{wish.name}</span>
          {wish.relationship && <span className="block truncate text-xs text-muted">{wish.relationship}</span>}
        </span>
        {wish.created_at && <span className="shrink-0 text-[0.7rem] text-muted/80">{timeAgo(wish.created_at)}</span>}
      </figcaption>
    </figure>
  )
}
