// Bride & groom: oval portraits with a rose spray over one corner, names in
// script, full names, parents, a short bio and an optional Instagram link.
import { AtSign } from 'lucide-react'
import { weddingData } from '../../data/weddingData.js'
import { instagramLink } from '../../lib/content.js'
import { FloralCorner } from '../decor/Floral.jsx'
import { PhotoPlaceholder } from '../ui/PhotoPlaceholder.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

function ProfileCard({ person, corner, tone, delay }) {
  const ig = instagramLink(person.instagram)
  return (
    <Reveal delay={delay} as="article" className="flex flex-col items-center text-center">
      <div className="relative w-full max-w-[17rem]">
        <FloralCorner position={corner} className={`absolute z-10 ${corner === 'top-left' ? '-top-8 -left-10' : '-top-8 -right-10'}`} size="w-28 sm:w-32" />
        <div className="absolute -inset-3 rounded-[50%] border border-gold/40" aria-hidden="true" />
        <SmartImage
          src={person.photo}
          alt={person.fullName}
          loading="lazy"
          className="relative aspect-[4/5] w-full rounded-[50%] object-cover shadow-lift"
          fallback={<PhotoPlaceholder label={person.role} tone={tone} rounded="rounded-[50%]" className="relative aspect-[4/5] w-full shadow-lift" />}
        />
      </div>
      <p className="eyebrow mt-10">{person.role}</p>
      <h3 className="mt-2 font-script text-6xl leading-tight font-normal text-gold-deep">{person.firstName}</h3>
      <p className="mt-1 font-display text-sm tracking-[0.18em] text-ink uppercase">{person.fullName}</p>
      {person.parents && <p className="mt-3 max-w-xs font-serif text-lg leading-snug text-muted italic">{person.parents}</p>}
      {person.bio && <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-ink/80">{person.bio}</p>}
      {ig && (
        <a href={ig.href} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4 min-h-10 text-xs">
          <AtSign className="size-4" aria-hidden="true" /> {ig.handle}
        </a>
      )}
    </Reveal>
  )
}

export function CoupleProfile() {
  const { groom, bride } = weddingData.couple
  return (
    <Section id="couple" tone="champagne">
      <SectionTitle eyebrow="The happy couple" title="Bride & Groom" />
      <div className="mx-auto mt-20 grid max-w-5xl items-start gap-20 md:grid-cols-[1fr_auto_1fr] md:gap-10">
        <ProfileCard person={groom} corner="top-left" tone={1} />
        <span className="hidden self-center font-script text-8xl text-gold/60 md:block" aria-hidden="true">
          &amp;
        </span>
        <ProfileCard person={bride} corner="top-right" tone={2} delay={0.12} />
      </div>
    </Section>
  )
}
