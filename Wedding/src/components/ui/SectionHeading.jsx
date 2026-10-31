import { Divider } from './Ornaments.jsx'
import { Reveal } from './Reveal.jsx'

export function SectionHeading({ eyebrow, title, children, as: Heading = 'h2', className = '' }) {
  return (
    <Reveal className={`mx-auto max-w-2xl text-center ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Heading className="mt-3 text-4xl leading-tight sm:text-5xl">{title}</Heading>
      <Divider className="mt-5" />
      {children && <div className="mt-5 text-base leading-[1.7] text-muted sm:text-lg">{children}</div>}
    </Reveal>
  )
}

/** Page wrapper used by the inner (non-home) pages. */
export function PageShell({ eyebrow, title, intro, children, width = 'wide' }) {
  return (
    <div className="pt-28 pb-24 sm:pt-36">
      <SectionHeading eyebrow={eyebrow} title={title} as="h1" className="px-5">
        {intro}
      </SectionHeading>
      <div className={`${width === 'wide' ? 'container-wide' : 'container-narrow'} mt-12 sm:mt-16`}>{children}</div>
    </div>
  )
}
