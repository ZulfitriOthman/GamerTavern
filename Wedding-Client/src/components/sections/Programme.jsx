// Atur Cara Majlis: a vertical timeline on fine burgundy lines with 8-point-star
// markers, inside an arch-topped card. Time labels are shown exactly as
// supplied ("2:00 PM – 2:30 PM", "Seterusnya", …).
import { weddingData } from '../../data/weddingData.js'
import { Sprig } from '../decor/Floral.jsx'
import { EightPointStar } from '../decor/Geometric.jsx'
import { ArchPanel } from '../ui/ArchPanel.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

export function Programme() {
  const { programme, event } = weddingData
  return (
    <Section id="atur-cara" tone="ivory">
      <SectionTitle eyebrow={`${event.day}, ${event.dateText}`} title="Atur Cara Majlis" />

      <Reveal className="relative mx-auto mt-14 max-w-2xl">
        <ArchPanel bodyClassName="pb-14 sm:px-12">
          <p className="eyebrow">{event.hijriDate}</p>

          <ol className="relative mt-10 text-left">
            {/* fine double line: left on phones, centred on wider screens */}
            <span className="absolute top-3 bottom-3 left-[0.95rem] w-px bg-gradient-to-b from-primary/10 via-primary/55 to-primary/10 sm:left-1/2" aria-hidden="true" />
            <span className="absolute top-8 bottom-8 left-[calc(0.95rem+4px)] w-px bg-primary/12 sm:left-[calc(50%+4px)]" aria-hidden="true" />
            {programme.map((item, i) => (
              <Reveal as="li" key={i} delay={i * 0.08} className="relative mb-10 pl-12 last:mb-0 sm:grid sm:grid-cols-2 sm:gap-12 sm:pl-0">
                <span className={`absolute top-0 left-[0.95rem] grid -translate-x-1/2 place-items-center rounded-full bg-white sm:left-1/2 ${item.highlight ? 'size-9' : 'size-7'}`} aria-hidden="true">
                  <EightPointStar className={item.highlight ? 'size-9 text-primary' : 'size-6 text-bronze'} filled={item.highlight} />
                </span>
                <p className="pt-1.5 font-display text-[0.76rem] font-medium tracking-[0.18em] text-bronze-deep uppercase sm:pt-2 sm:text-right">{item.when}</p>
                <p className={`mt-1 font-serif leading-snug sm:mt-0 ${item.highlight ? 'text-[1.55rem] font-semibold text-primary sm:text-[1.75rem]' : 'text-[1.3rem] font-medium text-ink sm:pt-1 sm:text-[1.4rem]'}`}>
                  {item.title}
                </p>
              </Reveal>
            ))}
          </ol>

          <Sprig className="mx-auto mt-10 w-24 opacity-90" />
        </ArchPanel>
      </Reveal>
    </Section>
  )
}
