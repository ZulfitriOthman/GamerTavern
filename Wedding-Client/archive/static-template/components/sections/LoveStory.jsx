// Love-story timeline: arched photos alternating either side of a gold line
// (desktop) or one column with the line on the left (phones).
import { weddingData } from '../../data/weddingData.js'
import { PhotoPlaceholder } from '../ui/PhotoPlaceholder.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

export function LoveStory() {
  const { story } = weddingData
  return (
    <Section id="story" tone="ivory">
      <SectionTitle eyebrow="How it all began" title="Our Love Story">
        <p className="font-serif text-xl italic">{story.intro}</p>
      </SectionTitle>

      <ol className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
        <span className="absolute top-4 bottom-4 left-5 w-px bg-gradient-to-b from-transparent via-gold/60 to-transparent md:left-1/2" aria-hidden="true" />
        {story.chapters.map((chapter, i) => {
          const flip = i % 2 === 1
          return (
            <li key={chapter.title} className="relative mb-16 pl-14 last:mb-0 md:mb-24 md:grid md:grid-cols-2 md:items-center md:gap-20 md:pl-0">
              {/* numbered medallion on the line */}
              <span className="absolute top-0 left-5 z-10 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-gold/60 bg-ivory font-display text-xs tracking-[0.1em] text-gold-deep shadow-soft md:top-1/2 md:left-1/2 md:size-12 md:-translate-y-1/2">
                {String(i + 1).padStart(2, '0')}
              </span>

              <Reveal className={`${flip ? 'md:order-2' : ''}`}>
                <div className={`relative mx-auto w-full max-w-xs ${flip ? 'md:mr-auto md:ml-0' : 'md:mr-0 md:ml-auto'}`}>
                  <div className="arch absolute -inset-2.5 border border-gold/35" aria-hidden="true" />
                  <SmartImage
                    src={chapter.image}
                    alt={chapter.title}
                    loading="lazy"
                    className="arch relative aspect-[4/5] w-full object-cover shadow-lift"
                    fallback={<PhotoPlaceholder label={chapter.title} tone={i} rounded="arch" className="relative aspect-[4/5] w-full shadow-lift" />}
                  />
                </div>
              </Reveal>

              <Reveal delay={0.1} className={`mt-7 md:mt-0 ${flip ? 'md:order-1 md:text-right' : ''}`}>
                <p className="font-script text-4xl leading-none text-gold">{chapter.date}</p>
                <h3 className="mt-3 font-serif text-3xl font-medium sm:text-4xl">{chapter.title}</h3>
                <p className={`mt-4 max-w-md leading-relaxed text-muted ${flip ? 'md:ml-auto' : ''}`}>{chapter.text}</p>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
