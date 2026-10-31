// The formal invitation card: opening lines, heading, date, wording, the
// couple's full names and the family lists. Hidden when none of it is set.
import { useSite } from '../../context/SiteContext.jsx'
import { coupleNames, familyGroups } from '../../lib/content.js'
import { formatDate } from '../../lib/time.js'
import { FamilySection } from '../events/FamilySection.jsx'
import { Reveal } from '../ui/Reveal.jsx'
import { Ornament, Section } from '../ui/Section.jsx'

export function Invitation() {
  const { content, settings, locale, ready } = useSite()
  const inv = content.invitation
  const names = coupleNames(content.couple)
  const groups = familyGroups(inv)
  const fullOne = content.couple.fullNameOne || names.a
  const fullTwo = content.couple.fullNameTwo || names.b
  if (!ready || (!inv.heading && !inv.message && !groups.length && !fullOne && !fullTwo)) return null

  return (
    <Section id="invitation" tone="ivory">
      <Reveal className={`relative mx-auto bg-white px-5 py-14 text-center shadow-lift sm:px-12 sm:py-20 ${groups.length > 1 ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* printed-card double frame */}
        <div className="pointer-events-none absolute inset-3 border border-gold/35 sm:inset-5" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-[1.1rem] border border-gold/15 sm:inset-7" aria-hidden="true" />

        <div className="relative px-1 sm:px-6">
          {inv.bismillah && (
            <p lang="ar" dir="rtl" className="font-arabic text-3xl leading-loose text-gold-deep sm:text-4xl">
              {inv.bismillah}
            </p>
          )}
          {inv.salam && (
            <p lang="ar" dir="rtl" className="mt-1 font-arabic text-xl leading-loose text-muted">
              {inv.salam}
            </p>
          )}
          {inv.salutation && <p className="eyebrow mt-6">{inv.salutation}</p>}
          {inv.heading && <h2 className="mx-auto mt-4 max-w-3xl text-2xl leading-snug tracking-[0.14em] text-balance uppercase sm:text-[2.1rem]">{inv.heading}</h2>}
          <Ornament className="mt-6" />

          {settings.wedding_date && (
            <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-4 sm:gap-6">
              <span className="flex-1 border-y border-gold/40 py-2 text-right text-[0.68rem] font-semibold tracking-[0.26em] text-muted uppercase sm:text-xs">
                {formatDate(settings.wedding_date, locale, { weekday: 'long' })}
              </span>
              <span className="font-display text-6xl leading-none text-gold-deep sm:text-7xl">{formatDate(settings.wedding_date, locale, { day: 'numeric' })}</span>
              <span className="flex-1 border-y border-gold/40 py-2 text-left text-[0.68rem] font-semibold tracking-[0.26em] text-muted uppercase sm:text-xs">
                {formatDate(settings.wedding_date, locale, { month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}
          {content.hijriDate && <p className="mt-4 font-serif text-lg text-sage-deep italic">{content.hijriDate}</p>}

          {inv.nameNote && <p className="mt-6 text-xs text-muted italic">{inv.nameNote}</p>}
          {inv.message && <p className="mx-auto mt-6 max-w-xl font-serif text-lg leading-relaxed whitespace-pre-line text-ink/85 text-balance">{inv.message}</p>}

          {(fullOne || fullTwo) && (
            <div className="my-10 space-y-3">
              {fullOne && <p className="font-display text-2xl tracking-[0.06em] text-ink sm:text-3xl">{fullOne}</p>}
              {fullOne && fullTwo && <p className="font-script text-4xl leading-none text-gold">{inv.conjunction || '&'}</p>}
              {fullTwo && <p className="font-display text-2xl tracking-[0.06em] text-ink sm:text-3xl">{fullTwo}</p>}
            </div>
          )}

          {inv.closing && <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed whitespace-pre-line text-muted">{inv.closing}</p>}

          <FamilySection groups={groups} heading={inv.familyHeading} />
        </div>
      </Reveal>
    </Section>
  )
}
