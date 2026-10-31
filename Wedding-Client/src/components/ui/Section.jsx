import { FloralDivider } from '../decor/Floral.jsx'
import { Reveal } from './Reveal.jsx'

const TONES = {
  ivory: 'bg-paper',
  tint: 'bg-mist bg-geometric',
  dark: 'bg-night text-ivory',
}

/** A full-width page section with consistent rhythm. `id` is the navbar anchor. */
export function Section({ id, tone = 'ivory', className = '', children, ...props }) {
  return (
    <section id={id} className={`relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 ${TONES[tone]} ${className}`} {...props}>
      {children}
    </section>
  )
}

/** Italic serif eyebrow, engraved capital title, floral divider and optional intro. */
export function SectionTitle({ eyebrow, title, children, light = false, className = '' }) {
  return (
    <Reveal className={`relative mx-auto max-w-2xl text-center ${className}`}>
      {eyebrow && <p className={`font-serif text-lg italic sm:text-xl ${light ? 'text-blush' : 'text-bronze-deep'}`}>{eyebrow}</p>}
      <h2 className={`mt-2 font-display text-[1.85rem] leading-tight tracking-[0.12em] text-balance uppercase sm:text-[2.6rem] ${light ? 'text-ivory' : 'text-primary'}`}>{title}</h2>
      <FloralDivider className="mt-5" />
      {children && <div className={`mt-5 text-[0.95rem] leading-relaxed text-balance ${light ? 'text-ivory/75' : 'text-muted'}`}>{children}</div>}
    </Reveal>
  )
}
