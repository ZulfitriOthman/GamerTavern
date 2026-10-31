// The one-page invitation. Each section hides itself when it has nothing to
// show (see hooks/useSiteSections.js), so the page reads well at every stage
// of planning. The navbar links point at these section ids.
import { Camera } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Envelope } from '../components/home/Envelope.jsx'
import { Countdown } from '../components/sections/Countdown.jsx'
import { Couple } from '../components/sections/Couple.jsx'
import { GallerySection } from '../components/sections/GallerySection.jsx'
import { Hero } from '../components/sections/Hero.jsx'
import { Invitation } from '../components/sections/Invitation.jsx'
import { OurStory } from '../components/sections/OurStory.jsx'
import { RsvpSection } from '../components/sections/RsvpSection.jsx'
import { Venue } from '../components/sections/Venue.jsx'
import { WeddingEvents } from '../components/sections/WeddingEvents.jsx'
import { WishesSection } from '../components/sections/WishesSection.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { sessionFlag } from '../hooks/useAsync.js'
import { useSiteSections } from '../hooks/useSiteSections.js'
import { monogram, siteTitle } from '../lib/content.js'
import { clean } from '../lib/validation.js'

const ENVELOPE_KEY = 'wedding:envelope-opened'

export default function HomePage() {
  const { content, events, status, ready, settings } = useSite()
  const visible = useSiteSections()
  const [params] = useSearchParams()
  const guestName = clean(params.get('to')).slice(0, 60)
  const [showEnvelope, setShowEnvelope] = useState(() => !sessionFlag(ENVELOPE_KEY))
  const envelope = showEnvelope && content.sections.envelope !== false && status !== 'error'

  const closeEnvelope = () => {
    sessionFlag(ENVELOPE_KEY, '1')
    setShowEnvelope(false)
  }

  return (
    <>
      {envelope && <Envelope names={siteTitle(content, events)} monogram={monogram(content.couple)} guestName={guestName} eyebrow={content.hero.eyebrow} onDone={closeEnvelope} />}
      <Hero delay={envelope ? 0.3 : 0} />
      {visible.countdown && <Countdown />}
      <Invitation />
      {visible.story && <OurStory />}
      {visible.couple && <Couple />}
      {visible.events && <WeddingEvents />}
      {visible.venue && <Venue />}
      {visible.gallery && <GallerySection />}
      {ready && <RsvpSection />}
      {visible.wishes && ready && <WishesSection />}
      {ready && settings.photo_uploads_enabled && <ShareBand />}
    </>
  )
}

/** A quiet prompt for the photo-sharing page (also reachable by QR code at the venue). */
function ShareBand() {
  return (
    <section className="bg-beige px-4 py-16 sm:py-20">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <span className="grid size-16 shrink-0 place-items-center rounded-full border border-gold/50 text-gold-deep">
          <Camera className="size-7" strokeWidth={1.3} aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl tracking-[0.14em] uppercase">Share your memories</h2>
          <p className="mt-2 text-muted">Took a photo on the day? Add it to our album — straight from your phone.</p>
        </div>
        <Link to="/share" className="btn-primary shrink-0">
          Share photos
        </Link>
      </Reveal>
    </section>
  )
}
