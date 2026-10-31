import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { mediaUrl } from '../../lib/api.js'
import { formatDate, formatTime } from '../../lib/time.js'
import { FloralCorner, Divider, InvitationMonogram } from '../ui/Ornaments.jsx'
import { Countdown } from './Countdown.jsx'

export function Hero() {
  const { content, settings } = useSite()
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const imageY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 120])
  const { partnerOne, partnerTwo, monogram } = content.couple
  const image = mediaUrl(content.hero.imageUrl)
  const rsvpOpen = settings.rsvp_mode !== 'closed'

  const fade = (delay) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1, delay, ease: [0.22, 1, 0.36, 1] } }

  return (
    <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pt-24 pb-16 text-center">
      {image ? (
        <>
          <motion.img src={image} alt="" style={{ y: imageY }} className="absolute inset-0 -z-20 h-[115%] w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ivory/85 via-ivory/75 to-ivory" />
        </>
      ) : (
        <div className="hero-wash absolute inset-0 -z-20" />
      )}

      <FloralCorner className="absolute -bottom-4 -left-10 -z-10 h-64 w-56 opacity-70 sm:h-96 sm:w-80" />
      <FloralCorner flip className="absolute -right-10 -bottom-4 -z-10 h-56 w-48 opacity-60 sm:h-80 sm:w-72" />

      <div className="relative w-full max-w-3xl">
        {content.invitation.bismillah && (
          <motion.p lang="ar" dir="rtl" className="py-1 font-arabic text-[2.125rem] leading-[1.8] text-gold-deep sm:text-5xl" {...fade(0.05)}>
            {content.invitation.bismillah}
          </motion.p>
        )}
        <motion.p className="mt-5 font-serif text-2xl font-semibold tracking-[0.12em] text-olive uppercase sm:text-4xl" {...fade(0.15)}>
          {content.hero.eyebrow}
        </motion.p>

        <motion.div className="mt-4" {...fade(0.3)}>
          <InvitationMonogram letters={monogram || `${partnerOne[0]}${partnerTwo[0]}`} left={partnerOne} right={partnerTwo} />
        </motion.div>

        <motion.h1 className="mt-4 font-script text-5xl leading-tight font-normal text-ink sm:text-7xl" {...fade(0.45)}>
          {partnerOne} <span className="font-serif text-3xl text-gold-deep italic sm:text-5xl">&amp;</span> {partnerTwo}
        </motion.h1>
        {content.hero.tagline && (
          <motion.p className="mt-3 font-serif text-xl text-muted italic sm:text-2xl" {...fade(0.5)}>
            {content.hero.tagline}
          </motion.p>
        )}

        <motion.div {...fade(0.6)}>
          <Divider className="mt-6" />
          {settings.wedding_date ? (
            <p className="mt-5 font-serif text-[1.75rem] leading-snug font-semibold tracking-wide text-ink sm:text-4xl">
              {formatDate(settings.wedding_date, content.locale)}
              {content.hijriDate && <span className="mt-1 block text-xl font-medium text-muted italic sm:text-2xl">{content.hijriDate}</span>}
              {settings.wedding_time && (
                <span className="mt-2 block font-sans text-base font-semibold tracking-[0.14em] text-olive uppercase sm:text-lg">{formatTime(settings.wedding_time, content.locale)}</span>
              )}
            </p>
          ) : (
            <p className="mt-6 font-serif text-2xl text-muted italic">Tarikh akan dimaklumkan</p>
          )}
        </motion.div>

        {content.sections.countdown && settings.wedding_date && (
          <motion.div {...fade(0.75)}>
            <Countdown className="mt-8" date={settings.wedding_date} time={settings.wedding_time} timeZone={settings.timezone} />
          </motion.div>
        )}

        <motion.div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row" {...fade(0.9)}>
          {rsvpOpen && (
            <Link to="/rsvp" className="btn-primary w-full max-w-64 sm:w-auto">
              RSVP
            </Link>
          )}
          <Link to={content.sections.events ? '/events' : '/info'} className="btn-outline w-full max-w-64 sm:w-auto">
            Wedding details
          </Link>
        </motion.div>
      </div>

      <a href="#invitation" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gold" aria-label="Scroll to invitation">
        <ChevronDown className="size-6 motion-safe:animate-bounce" />
      </a>
    </section>
  )
}
