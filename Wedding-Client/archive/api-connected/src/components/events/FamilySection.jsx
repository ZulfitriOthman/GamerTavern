// Family lists (e.g. PIHAK LELAKI / PIHAK PEREMPUAN): two formal columns on
// larger screens, stacked on phones. Each name sits on its own line and wraps
// gracefully; blank lines in the stored list become small ornamental gaps.
import { Fragment } from 'react'
import { Reveal } from '../ui/Reveal.jsx'

function Diamond() {
  return (
    <span className="my-4 flex items-center justify-center gap-2 text-gold/70" aria-hidden="true">
      <span className="h-px w-6 bg-current" />
      <span className="size-1.5 rotate-45 bg-current" />
      <span className="h-px w-6 bg-current" />
    </span>
  )
}

export function FamilySection({ groups, heading }) {
  if (!groups.length) return null
  const two = groups.length > 1
  return (
    <section aria-label={heading || 'Families'} className="mt-12">
      {heading && <p className="eyebrow text-center">{heading}</p>}
      <div className={`mx-auto mt-6 grid gap-10 ${two ? 'md:grid-cols-2 md:gap-0' : 'max-w-md'}`}>
        {groups.map((g, i) => (
          <Reveal key={i} delay={i * 0.1} className={`px-1 text-center ${two && i > 0 ? 'md:border-l md:border-gold/30' : ''} ${two ? 'md:px-8' : ''}`}>
            {g.title && (
              <h3 className="font-display text-lg tracking-[0.24em] text-gold-deep uppercase sm:text-xl">
                {g.title}
              </h3>
            )}
            <span className="mx-auto mt-3 block h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden="true" />
            <div className="mt-5">
              {g.blocks.map((block, b) => (
                <Fragment key={b}>
                  {b > 0 && <Diamond />}
                  <ul className="space-y-1.5">
                    {block.map((name, n) => (
                      <li key={n} className="font-serif text-[1.02rem] leading-snug text-ink/90 text-balance [overflow-wrap:break-word] sm:text-lg">
                        {name}
                      </li>
                    ))}
                  </ul>
                </Fragment>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
