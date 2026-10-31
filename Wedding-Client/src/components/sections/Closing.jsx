import { weddingData } from '../../data/weddingData.js'
import { coupleShort } from '../../lib/content.js'
import { FloralCorner, FloralDivider, FloralGarland } from '../decor/Floral.jsx'
import { ArchPanel } from '../ui/ArchPanel.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section } from '../ui/Section.jsx'

/** Penutup: thanks for the guests' presence and prayers, in a closing arch with florals. */
export function Closing() {
  const { closing, event, couple } = weddingData
  return (
    <Section id="penutup" tone="tint" className="pb-32 sm:pb-40">
      <Reveal className="relative mx-auto max-w-2xl">
        <FloralCorner position="bottom-left" className="absolute -bottom-6 -left-3 z-10 sm:-bottom-10 sm:-left-24" size="w-28 sm:w-48" />
        <FloralCorner position="bottom-right" className="absolute -right-3 -bottom-6 z-10 sm:-right-24 sm:-bottom-10" size="w-28 sm:w-48" />
        <FloralGarland className="absolute bottom-0 left-1/2 z-10 w-60 -translate-x-1/2 translate-y-[42%] sm:w-80" />
        <ArchPanel bodyClassName="pb-28 sm:px-14 sm:pb-32">
          <h2 className="font-serif text-[3.2rem] leading-tight font-medium tracking-normal text-primary italic sm:text-7xl">{closing.title}</h2>
          <FloralDivider className="mt-3" />
          <p className="mx-auto mt-7 max-w-lg font-serif text-[1.35rem] leading-relaxed font-medium text-balance text-ink sm:text-[1.6rem]">{closing.message}</p>
          <p className="mt-6 font-serif text-xl text-bronze-deep italic">{closing.signOff}</p>
          <p className="mt-10 font-serif text-[1.9rem] leading-tight font-medium text-balance text-primary italic sm:text-[2.2rem]">{coupleShort(couple)}</p>
          <p className="mt-4 font-display text-[0.72rem] leading-relaxed tracking-[0.22em] text-balance text-primary uppercase">{event.title}</p>
          <p className="mt-2 font-display text-[0.68rem] leading-relaxed tracking-[0.2em] text-balance text-muted uppercase">
            {event.day}, {event.dateText} · {event.hijriDate}
          </p>
        </ArchPanel>
      </Reveal>
    </Section>
  )
}
