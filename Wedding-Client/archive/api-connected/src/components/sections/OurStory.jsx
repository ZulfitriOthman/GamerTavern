// "Our Story": an arched photo beside how they met, then the milestones on a
// centred timeline (alternating sides on wide screens, one column on phones).
import { LOCAL_IMAGES } from '../../config/images.js'
import { useSite } from '../../context/SiteContext.jsx'
import { labels } from '../../lib/labels.js'
import { Reveal } from '../ui/Reveal.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'
import { SmartImage } from '../ui/SmartImage.jsx'

export function OurStory({ id = 'story' }) {
  const { content, locale } = useSite()
  const { story } = content
  const timeline = (story.timeline ?? []).filter((t) => t?.title)

  return (
    <Section id={id} tone="beige">
      <SectionTitle kicker={labels(locale).storyKicker} title={story.howWeMet.title || 'How it all began'}>
        {story.intro && <p className="whitespace-pre-line">{story.intro}</p>}
      </SectionTitle>

      {story.howWeMet.text && (
        <div className="mx-auto mt-14 grid max-w-5xl items-center gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <SmartImage
            sources={[story.howWeMet.imageUrl, LOCAL_IMAGES.story]}
            alt="The couple"
            loading="lazy"
            className="arch mx-auto aspect-[4/5] w-full max-w-sm object-cover shadow-lift"
            fallback={
              <div className="arch mx-auto flex aspect-[4/5] w-full max-w-sm items-center justify-center border border-gold/40 bg-ivory" aria-hidden="true">
                <span className="font-script text-7xl text-gold/70">&amp;</span>
              </div>
            }
          />
          <Reveal delay={0.1}>
            <p
              className={`font-serif text-xl leading-relaxed whitespace-pre-line text-ink/90 ${
                story.howWeMet.text.length > 220 ? 'first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-6xl first-letter:leading-[0.85] first-letter:text-gold-deep' : ''
              }`}
            >
              {story.howWeMet.text}
            </p>
          </Reveal>
        </div>
      )}

      {timeline.length > 0 && (
        <ol className="relative mx-auto mt-20 max-w-4xl">
          <span className="absolute top-0 bottom-0 left-[1.1rem] w-px bg-gradient-to-b from-transparent via-gold/60 to-transparent md:left-1/2" aria-hidden="true" />
          {timeline.map((item, i) => {
            const right = i % 2 === 1
            return (
              <li key={i} className="relative mb-14 pl-12 last:mb-0 md:grid md:grid-cols-2 md:gap-16 md:pl-0">
                <span className="absolute top-1.5 left-[1.1rem] grid size-4 -translate-x-1/2 place-items-center rounded-full border border-gold bg-beige md:left-1/2" aria-hidden="true">
                  <span className="size-1.5 rounded-full bg-gold" />
                </span>
                <Reveal className={right ? 'md:col-start-2' : 'md:text-right'}>
                  {item.date && <p className="font-script text-3xl leading-none text-gold">{item.date}</p>}
                  <h3 className="mt-2 text-xl tracking-[0.12em] uppercase sm:text-2xl">{item.title}</h3>
                  {item.text && <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{item.text}</p>}
                  {item.imageUrl && (
                    <SmartImage
                      sources={[item.imageUrl]}
                      alt={item.title}
                      loading="lazy"
                      className={`mt-5 aspect-[4/3] w-full max-w-sm rounded-2xl object-cover shadow-soft ${right ? '' : 'md:ml-auto'}`}
                    />
                  )}
                </Reveal>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}
