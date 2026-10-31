// Undangan: the bride's and groom's official names, then Pihak Lelaki &
// Pihak Perempuan in matching arch-topped invitation
// cards, side by side on wide screens and stacked on phones. Names appear one
// per line, in the supplied order, and wrap evenly instead of overflowing.
import { weddingData } from '../../data/weddingData.js'
import { FloralDivider, FloralGarland } from '../decor/Floral.jsx'
import { EightPointStar } from '../decor/Geometric.jsx'
import { ArchPanel } from '../ui/ArchPanel.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

function FamilyCard({ family, delay }) {
  const headingId = `${family.id}-title`
  return (
    <Reveal delay={delay} className="h-full">
      <section id={family.id} aria-labelledby={headingId} className="relative h-full scroll-mt-24">
        <ArchPanel className="h-full" bodyClassName="flex h-full flex-col pb-20 sm:pb-24">
          <p className="eyebrow">Undangan</p>
          <h3 id={headingId} className="mt-2 font-display text-[1.6rem] tracking-[0.1em] text-primary uppercase sm:text-[1.9rem]">
            {family.title}
          </h3>
          <FloralDivider className="mt-3" />

          <ol className="mt-7 flex flex-1 flex-col justify-center space-y-3">
            {family.members.map((name, i) => (
              <li key={i} className="font-serif text-[1.14rem] leading-snug font-medium text-balance text-ink [overflow-wrap:anywhere] sm:text-[1.28rem]">
                {i > 0 && <EightPointStar className="mx-auto mb-3 block size-2.5 text-bronze/70" />}
                {name}
              </li>
            ))}
          </ol>
        </ArchPanel>
        <FloralGarland className="absolute bottom-0 left-1/2 w-52 -translate-x-1/2 translate-y-[38%] sm:w-60" />
      </section>
    </Reveal>
  )
}

/** Pengantin Lelaki & Pengantin Perempuan, with their full official names. */
function Couple({ couple }) {
  const person = (p) => (
    <div>
      <p className="eyebrow">{p.role}</p>
      <p className="mt-2 font-serif text-[1.6rem] leading-snug font-medium text-balance text-primary [overflow-wrap:anywhere] sm:text-[2rem]">{p.fullName}</p>
    </div>
  )
  return (
    <Reveal className="mx-auto mt-10 max-w-2xl text-center">
      {person(couple.groom)}
      <p className="my-4 font-serif text-4xl leading-none text-floral italic" aria-hidden="true">
        &amp;
      </p>
      {person(couple.bride)}
      <FloralDivider className="mt-8" />
    </Reveal>
  )
}

export function Families() {
  const { families, couple } = weddingData
  return (
    <Section id="undangan" tone="tint" className="pb-28 sm:pb-36">
      <SectionTitle eyebrow="Dengan Penuh Hormat" title="Undangan" />
      <Couple couple={couple} />
      <div className={`mx-auto mt-14 grid gap-20 ${families.length > 1 ? 'max-w-5xl lg:grid-cols-2 lg:gap-12' : 'max-w-xl'}`}>
        {families.map((family, i) => (
          <FamilyCard key={family.id} family={family} delay={i * 0.1} />
        ))}
      </div>
    </Section>
  )
}
