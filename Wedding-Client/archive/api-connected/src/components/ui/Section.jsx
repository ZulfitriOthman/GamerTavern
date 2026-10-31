import { Reveal } from './Reveal.jsx'

const TONES = {
  ivory: 'bg-ivory',
  beige: 'bg-beige',
  dark: 'bg-espresso text-ivory',
}

/** A full-width page section with consistent rhythm. `id` is the navbar anchor. */
export function Section({ id, tone = 'ivory', className = '', children, ...props }) {
  return (
    <section id={id} className={`relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 ${TONES[tone]} ${className}`} {...props}>
      {children}
    </section>
  )
}

/** Script kicker, display-capital title, hairline ornament and optional intro. */
export function SectionTitle({ kicker, title, children, light = false, className = '' }) {
  return (
    <Reveal className={`mx-auto max-w-2xl text-center ${className}`}>
      {kicker && <p className={`font-script text-3xl leading-none sm:text-4xl ${light ? 'text-champagne' : 'text-gold'}`}>{kicker}</p>}
      <h2 className={`mt-2 text-[1.9rem] leading-tight tracking-[0.14em] text-balance uppercase sm:text-[2.6rem] ${light ? 'text-ivory' : ''}`}>{title}</h2>
      <Ornament light={light} className="mt-5" />
      {children && <div className={`mt-5 text-[0.98rem] leading-relaxed text-balance ${light ? 'text-ivory/75' : 'text-muted'}`}>{children}</div>}
    </Reveal>
  )
}

/** Header for inner pages (clears the fixed navbar). */
export function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="bg-beige px-4 pt-32 pb-14 sm:pt-40 sm:pb-20">
      <SectionTitle kicker={eyebrow} title={title}>
        {children}
      </SectionTitle>
    </header>
  )
}

/** Hairline with a small gold diamond — the site's single ornament. */
export function Ornament({ light = false, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${light ? 'text-champagne/70' : 'text-gold/70'} ${className}`} aria-hidden="true">
      <span className="h-px w-14 bg-gradient-to-r from-transparent to-current sm:w-20" />
      <span className="size-1.5 rotate-45 border border-current" />
      <span className="h-px w-14 bg-gradient-to-l from-transparent to-current sm:w-20" />
    </div>
  )
}
