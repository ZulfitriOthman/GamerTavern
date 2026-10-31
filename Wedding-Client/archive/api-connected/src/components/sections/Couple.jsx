// Bride & groom cards: arched portrait, role, name, parents, short bio and an
// optional Instagram link. Profiles are edited in /admin → Settings → The couple.
import { AtSign } from 'lucide-react'
import { LOCAL_IMAGES } from '../../config/images.js'
import { useSite } from '../../context/SiteContext.jsx'
import { instagramLink } from '../../lib/content.js'
import { labels } from '../../lib/labels.js'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

function PersonCard({ name, fullName, profile, localImage, delay }) {
  const ig = instagramLink(profile.instagram)
  const initial = (name || fullName || '').trim().charAt(0).toUpperCase()
  return (
    <Reveal delay={delay} as="article" className="flex flex-col items-center text-center">
      <div className="relative w-full max-w-[19rem]">
        <div className="arch absolute -inset-3 border border-gold/40" aria-hidden="true" />
        <SmartImage
          sources={[profile.photoUrl, localImage]}
          alt={fullName || name}
          loading="lazy"
          className="arch relative aspect-[4/5] w-full object-cover shadow-lift"
          fallback={
            <div className="arch relative flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-b from-linen to-champagne" aria-hidden="true">
              <span className="font-script text-8xl text-white/90">{initial || '♥'}</span>
            </div>
          }
        />
      </div>
      {profile.role && <p className="eyebrow mt-9">{profile.role}</p>}
      <h3 className={`${profile.role ? 'mt-3' : 'mt-9'} font-script text-5xl leading-tight text-gold-deep`}>{name || fullName}</h3>
      {fullName && name && fullName !== name && <p className="mt-2 font-display text-sm tracking-[0.16em] text-ink uppercase">{fullName}</p>}
      {profile.parents && <p className="mt-3 max-w-xs font-serif text-lg leading-snug text-muted italic">{profile.parents}</p>}
      {profile.bio && <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed whitespace-pre-line text-ink/80">{profile.bio}</p>}
      {ig && (
        <a href={ig.href} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4 min-h-10 text-xs">
          <AtSign className="size-4" aria-hidden="true" /> {ig.handle}
        </a>
      )}
    </Reveal>
  )
}

export function Couple() {
  const { content, locale } = useSite()
  const { couple } = content
  const profiles = couple.profiles ?? {}
  const people = [
    { name: couple.partnerOne, fullName: couple.fullNameOne, profile: profiles.one ?? {}, localImage: LOCAL_IMAGES.partnerOne },
    { name: couple.partnerTwo, fullName: couple.fullNameTwo, profile: profiles.two ?? {}, localImage: LOCAL_IMAGES.partnerTwo },
  ].filter((p) => p.name || p.fullName)

  return (
    <Section id="couple" tone="ivory">
      <SectionTitle kicker={labels(locale).coupleKicker} title={people.length > 1 ? 'The Bride & Groom' : 'The Couple'} />
      <div className={`mx-auto mt-16 grid max-w-5xl items-start gap-16 ${people.length > 1 ? 'md:grid-cols-[1fr_auto_1fr] md:gap-8' : 'max-w-md'}`}>
        {people.map((p, i) => (
          <div key={i} className="contents">
            {i === 1 && (
              <span className="hidden self-center font-script text-7xl text-gold/70 md:block" aria-hidden="true">
                &amp;
              </span>
            )}
            <PersonCard {...p} delay={i * 0.12} />
          </div>
        ))}
      </div>
    </Section>
  )
}
