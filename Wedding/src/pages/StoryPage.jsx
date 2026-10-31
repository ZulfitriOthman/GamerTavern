import { Heart } from 'lucide-react'
import { EmptyState } from '../components/ui/Feedback.jsx'
import { PhotoFrame } from '../components/ui/PhotoFrame.jsx'
import { Reveal } from '../components/ui/Reveal.jsx'
import { PageShell } from '../components/ui/SectionHeading.jsx'
import { useSite } from '../context/SiteContext.jsx'

export function StoryPage() {
  const { content } = useSite()
  const { story } = content
  const timeline = (story.timeline ?? []).filter((t) => t?.title)

  // The section stays switched off until the couple has written their story.
  if (!content.sections.story) {
    return (
      <PageShell eyebrow="Our story" title="How It All Began" width="narrow">
        <EmptyState icon={Heart} title="Coming soon">
          Our story will be shared here soon.
        </EmptyState>
      </PageShell>
    )
  }

  return (
    <PageShell eyebrow="Our story" title="How It All Began" intro={story.intro}>
      <section className="grid items-center gap-10 md:grid-cols-[5fr_6fr] md:gap-16">
        <Reveal>
          <PhotoFrame src={story.howWeMet.imageUrl} alt="How we met" className="aspect-[4/5] w-full" rounded="rounded-t-full rounded-b-[2rem]" />
        </Reveal>
        <Reveal delay={0.1} className="text-center md:text-left">
          <h2 className="text-4xl sm:text-5xl">{story.howWeMet.title}</h2>
          <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-muted">{story.howWeMet.text}</p>
        </Reveal>
      </section>

      {timeline.length > 0 && (
        <section className="mt-28">
          <h2 className="sr-only">Our milestones</h2>
          <ol className="relative mx-auto max-w-4xl">
            <span className="absolute top-0 bottom-0 left-5 w-px bg-gradient-to-b from-transparent via-gold/50 to-transparent md:left-1/2" aria-hidden="true" />
            {timeline.map((item, i) => {
              const right = i % 2 === 1
              return (
                <li key={i} className="relative mb-14 pl-14 last:mb-0 md:grid md:grid-cols-2 md:gap-16 md:pl-0">
                  <span className="absolute top-2 left-5 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-gold bg-ivory md:left-1/2" aria-hidden="true">
                    <Heart className="size-3.5 fill-gold/40 text-gold" />
                  </span>
                  <Reveal className={right ? 'md:col-start-2' : 'md:text-right'}>
                    <p className="eyebrow">{item.date}</p>
                    <h3 className="mt-2 text-3xl">{item.title}</h3>
                    {item.text && <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{item.text}</p>}
                  </Reveal>
                  {item.imageUrl && (
                    <Reveal delay={0.1} className={`mt-5 md:mt-0 ${right ? 'md:col-start-1 md:row-start-1' : ''}`}>
                      <PhotoFrame src={item.imageUrl} alt={item.title} className="aspect-[4/3] w-full" />
                    </Reveal>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </PageShell>
  )
}
