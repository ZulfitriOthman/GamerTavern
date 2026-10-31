import { Heart, Quote } from 'lucide-react'
import { useState } from 'react'
import { useSite } from '../../context/SiteContext.jsx'
import { Reveal } from '../ui/Reveal.jsx'

// Messages longer than this are shown clamped, with a "Read full wish" toggle.
const LONG_MESSAGE = 280

/**
 * One guest wish. Text is rendered as plain React text (escaped), so guest
 * content can never inject markup.
 */
export function WishCard({ wish, index = 0, clamp = false, reveal = true, className = '' }) {
  const { content } = useSite()
  const [expanded, setExpanded] = useState(false)
  const date = wish.created_at ? new Date(wish.created_at) : null
  const long = clamp && (wish.message?.length ?? 0) > LONG_MESSAGE
  const messageId = `wish-${wish.id}`

  // Inside the carousel the slide animates itself, so no scroll-reveal wrapper.
  const Wrapper = reveal ? Reveal : 'div'
  return (
    <Wrapper
      {...(reveal && { delay: (index % 3) * 0.06 })}
      className={`card group relative overflow-hidden p-7 transition duration-500 hover:-translate-y-1 hover:shadow-lift ${className}`}
    >
      <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden="true" />
      <Quote className="absolute top-5 right-5 size-7 text-champagne transition group-hover:text-gold/50" aria-hidden="true" />
      <Heart className="size-4 fill-rose/25 text-rose/60" aria-hidden="true" />
      <p
        id={messageId}
        className={`mt-3 font-serif text-lg leading-relaxed whitespace-pre-line text-ink ${long && !expanded ? 'line-clamp-6' : ''}`}
      >
        {wish.message}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={messageId}
          className="mt-2 text-sm font-semibold tracking-[0.1em] text-gold-deep uppercase underline-offset-4 hover:underline"
        >
          {expanded ? 'Show less' : 'Read full wish'}
        </button>
      )}
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
        <p className="text-base">
          <span className="font-semibold text-ink">{wish.name}</span>
          {wish.relationship && <span className="text-muted"> · {wish.relationship}</span>}
        </p>
      </div>
      {date && !Number.isNaN(date.getTime()) && (
        <time dateTime={date.toISOString()} className="mt-2 block pl-11 text-[0.8125rem] tracking-[0.08em] text-muted uppercase">
          {new Intl.DateTimeFormat(content.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}
        </time>
      )}
    </Wrapper>
  )
}
