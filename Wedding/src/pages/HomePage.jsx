import { ArrowRight, Camera, Heart, MailOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EventCard } from '../components/home/EventCard.jsx'
import { Hero } from '../components/home/Hero.jsx'
import { PhotoGrid } from '../components/gallery/PhotoGrid.jsx'
import { Monogram, Sprig } from '../components/ui/Ornaments.jsx'
import { PhotoFrame } from '../components/ui/PhotoFrame.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { SectionHeading } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { visibleFamilyGroups } from '../lib/family.js'
import { formatDate } from '../lib/time.js'
import { useAsync } from '../hooks/useAsync.js'
import { listApprovedPhotos } from '../services/photoService.js'
import { WishesWall } from '../components/wishes/WishesWall.jsx'

export function HomePage() {
  const { content, settings, events, connected } = useSite()
  const s = content.sections
  const photos = useAsync(() => (s.gallery && connected ? listApprovedPhotos({ limit: 8 }) : Promise.resolve([])), [s.gallery, connected])

  return (
    <>
      <Hero />

      <InvitationSection />


      {/* Events */}
      {s.events && (
        <section className="relative bg-gradient-to-b from-transparent via-cream/70 to-transparent py-24">
          <div className="container-wide">
            <SectionHeading eyebrow="Save the dates" title="Wedding Celebrations" />
            {events.length === 0 ? (
              <p className="mt-10 text-center font-serif text-xl text-muted italic">Event details will be announced soon.</p>
            ) : (
              <div className={`mt-14 grid gap-6 ${events.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-xl'} ${events.length > 2 ? 'lg:grid-cols-3' : ''}`}>
                {events.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </div>
            )}
            <div className="mt-10 text-center">
              <Link to="/events" className="btn-ghost">
                Full schedule &amp; programme <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Story teaser */}
      {s.story && (
        <section className="py-24">
          <div className="container-wide grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <Reveal className="relative">
              <PhotoFrame src={content.story.howWeMet.imageUrl} alt="The couple" className="aspect-[4/5] w-full" rounded="rounded-t-full rounded-b-[2rem]" />
              <Sprig className="absolute -bottom-10 -left-8 h-44 -rotate-12" />
            </Reveal>
            <div className="text-center md:text-left">
              <Reveal>
                <p className="eyebrow">Our story</p>
                <h2 className="mt-3 text-4xl sm:text-5xl">{content.story.howWeMet.title}</h2>
                <p className="mt-6 leading-relaxed whitespace-pre-line text-muted">{content.story.howWeMet.text}</p>
                <Link to="/story" className="btn-outline mt-8">
                  Read our story <ArrowRight className="size-4" />
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* Gallery teaser */}
      {s.gallery && (photos.data?.length ?? 0) > 0 && (
        <section className="py-24">
          <div className="container-wide">
            <SectionHeading eyebrow="Moments" title="Our Gallery" />
            <div className="mt-12">
              <PhotoGrid photos={photos.data} />
            </div>
            <div className="mt-10 text-center">
              <Link to="/gallery" className="btn-outline">
                View all photos <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Share memories + wishes CTAs */}
      {(settings.photo_uploads_enabled || settings.greetings_enabled) && (
        <section className="py-20">
          <div className="container-wide grid gap-6 md:grid-cols-2">
            {settings.photo_uploads_enabled && (
              <Reveal className="card flex flex-col items-center p-10 text-center">
                <Camera className="size-8 text-gold" strokeWidth={1.25} />
                <h2 className="mt-4 text-3xl">Share Your Memories</h2>
                <p className="mt-3 max-w-sm text-base text-muted">Captured a beautiful moment? Upload your photos and help us relive the day.</p>
                <Link to="/share" className="btn-gold mt-7">
                  Upload photos
                </Link>
              </Reveal>
            )}
            {settings.greetings_enabled && (
              <Reveal delay={0.1} className="card flex flex-col items-center p-10 text-center">
                <Heart className="size-8 text-gold" strokeWidth={1.25} />
                <h2 className="mt-4 text-3xl">Leave Your Wishes</h2>
                <p className="mt-3 max-w-sm text-base text-muted">Your blessings and kind words mean the world to us.</p>
                <Link to="/wishes" className="btn-outline mt-7">
                  Write a wish
                </Link>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* Wishes Wall — the latest guest wishes, right after the Share / Wishes cards */}
      {/* Only when the API answered — otherwise "be the first" would be untrue; the site-wide notice covers that case. */}
      {settings.greetings_enabled && connected && <WishesWall />}

      {/* RSVP band */}
      {settings.rsvp_mode !== 'closed' && (
        <section className="px-5 pt-10 pb-24">
          <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-ink px-6 py-16 text-center text-ivory shadow-lift sm:px-12">
            <Sprig className="absolute -bottom-8 -left-6 h-48 -rotate-12 opacity-40" />
            <Sprig className="absolute -top-10 -right-4 h-48 rotate-[160deg] opacity-30" bloom={false} />
            <MailOpen className="mx-auto size-8 text-champagne" strokeWidth={1.25} />
            <h2 className="mt-5 text-4xl text-ivory sm:text-5xl">Will you join us?</h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-ivory/90">Kindly let us know if you can attend so we can prepare a seat for you.</p>
            <Link to="/rsvp" className="btn mt-8 bg-champagne text-ink hover:bg-ivory">
              RSVP now
            </Link>
          </Reveal>
        </section>
      )}
    </>
  )
}

/** The formal invitation text, laid out after the printed card. */
function InvitationSection() {
  const { content, settings, events } = useSite()
  const inv = content.invitation
  const familyGroups = visibleFamilyGroups(inv)
  const main = events[0]
  return (
    <section id="invitation" className="relative scroll-mt-16 py-24 sm:py-32">
      {/* Wider than container-narrow and with less side gutter on phones, so the larger text has room. */}
      <div className="mx-auto w-full max-w-4xl px-3 text-center sm:px-8">
        <Reveal className="card relative overflow-hidden px-5 py-12 sm:px-14 sm:py-16">
          <Sprig className="absolute -top-6 -left-6 h-40 rotate-[140deg] opacity-30" bloom={false} />
          <Sprig className="absolute -right-6 -bottom-8 h-44 -rotate-12 opacity-30" />
          <Monogram text={content.couple.monogram} className="mx-auto size-16 text-xl" />
          {inv.salam && (
            // Generous line height so stacked harakat are never clipped when the greeting wraps.
            <p lang="ar" dir="rtl" className="mt-8 py-1 font-arabic text-[2.125rem] leading-[1.9] text-balance text-gold-deep sm:text-5xl sm:leading-[1.8]">
              {inv.salam}
            </p>
          )}
          {inv.message && <p className="mx-auto mt-6 max-w-2xl text-[1.0625rem] leading-[1.75] text-olive sm:text-xl">{inv.message}</p>}

          <div className="mt-8 font-serif text-[1.75rem] leading-snug font-semibold text-balance text-ink italic sm:text-4xl">
            <p>{content.couple.fullNameOne}</p>
            {inv.conjunction && <p className="my-1 text-2xl text-gold-deep sm:text-3xl">{inv.conjunction}</p>}
            <p>{content.couple.fullNameTwo}</p>
          </div>

          {(settings.wedding_date || main?.venue_name) && (
            <dl className="mx-auto mt-10 grid max-w-2xl overflow-hidden rounded-2xl border border-champagne sm:grid-cols-2">
              <div className="border-champagne px-4 py-6 sm:border-r sm:px-5">
                <dt className="font-serif text-xl font-medium text-olive underline underline-offset-4 sm:text-2xl">Pada</dt>
                <dd className="mt-2">
                  <span className="block font-serif text-[1.625rem] leading-snug font-semibold text-ink sm:text-3xl">{formatDate(settings.wedding_date, content.locale)}</span>
                  {content.hijriDate && <span className="mt-1 block text-base font-medium text-muted">{content.hijriDate}</span>}
                </dd>
              </div>
              <div className="border-t border-champagne px-4 py-6 sm:border-t-0 sm:px-5">
                <dt className="font-serif text-xl font-medium text-olive underline underline-offset-4 sm:text-2xl">Bertempat</dt>
                <dd className="mt-2 text-ink">
                  {main?.venue_name ? (
                    <>
                      <span className="block font-serif text-[1.375rem] leading-snug font-semibold text-balance sm:text-2xl">{main.venue_name}</span>
                      {main.address && <span className="mt-1 block text-base text-muted">{main.address}</span>}
                    </>
                  ) : (
                    <span className="text-muted italic">Akan dimaklumkan</span>
                  )}
                </dd>
              </div>
            </dl>
          )}

          {inv.closing && <p className="mx-auto mt-10 max-w-2xl text-base leading-[1.75] text-olive sm:text-lg">{inv.closing}</p>}
          {familyGroups.length > 0 && (
            <div className="mt-10">
              {inv.familyHeading && <p className="font-script text-4xl leading-tight text-gold-deep sm:text-5xl">{inv.familyHeading}</p>}
              <div className={`mx-auto mt-5 grid gap-8 ${familyGroups.length > 1 ? 'max-w-4xl md:-mx-8 md:grid-cols-2 md:gap-0' : 'max-w-xl'}`}>
                {familyGroups.map((group, i) => (
                  <div key={i} className={`px-1 sm:px-3 ${i > 0 ? 'border-t border-champagne pt-8 md:border-t-0 md:border-l md:pt-0' : ''}`}>
                    {group.title && <p className="eyebrow mb-4 tracking-[0.14em]">{group.title}</p>}
                    {/* Upright medium weight: the thin italic was the hardest text on the page for older guests. */}
                    <ul className="space-y-2 font-serif text-[1.1875rem] leading-snug font-medium text-ink sm:text-xl md:text-[1.1875rem] lg:text-xl">
                      {group.lines.map((line, j) => (
                        <li key={j} className="text-balance">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  )
}
