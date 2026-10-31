import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { formatDate } from '../../lib/time.js'
import { Divider } from '../ui/Ornaments.jsx'

export function Footer() {
  const { content, settings, coupleTitle } = useSite()
  return (
    <footer className="relative mt-auto border-t border-champagne/70 bg-cream/60">
      <div className="container-narrow py-14 text-center">
        <p className="font-script text-4xl text-ink sm:text-5xl">{coupleTitle}</p>
        {settings.wedding_date && (
          <p className="mt-3 eyebrow">{formatDate(settings.wedding_date, content.locale)}</p>
        )}
        <Divider className="my-6" />
        <p className="mx-auto max-w-md text-base text-muted">{content.footer.message}</p>
        {content.couple.hashtag && <p className="mt-3 font-serif text-lg text-gold-deep italic">{content.couple.hashtag}</p>}
        <p className="mt-10 flex items-center justify-center gap-1.5 text-[0.8125rem] tracking-[0.12em] text-muted uppercase">
          Made with <Heart className="size-3 fill-rose/60 text-rose/60" aria-label="love" /> for our guests
          <span className="mx-2">·</span>
          <Link to="/admin" className="hover:text-ink">
            Couple login
          </Link>
        </p>
      </div>
    </footer>
  )
}
