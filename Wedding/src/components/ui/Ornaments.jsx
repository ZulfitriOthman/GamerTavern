// Hand-drawn style botanical line art, rendered as inline SVG so it stays
// crisp at any size and needs no image downloads.

const LEAVES = [
  { y: 186, side: -1, s: 1 },
  { y: 164, side: 1, s: 1 },
  { y: 140, side: -1, s: 0.95 },
  { y: 116, side: 1, s: 0.9 },
  { y: 92, side: -1, s: 0.82 },
  { y: 70, side: 1, s: 0.72 },
  { y: 50, side: -1, s: 0.6 },
]

export function Sprig({ className = '', bloom = true, ...props }) {
  return (
    <svg viewBox="0 0 120 220" fill="none" aria-hidden="true" className={className} {...props}>
      <path d="M60 216 C 56 170, 66 120, 60 34" stroke="var(--color-sage-deep)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      {LEAVES.map(({ y, side, s }) => (
        <g key={y} transform={`translate(${60 + side * 3} ${y}) rotate(${side * -48}) scale(${s})`}>
          <path
            d="M0 0 C 6 -10, 22 -12, 30 0 C 22 12, 6 10, 0 0 Z"
            transform={side < 0 ? 'scale(-1 1)' : undefined}
            fill="var(--color-sage)"
            fillOpacity="0.45"
            stroke="var(--color-sage-deep)"
            strokeWidth="0.9"
            strokeOpacity="0.7"
          />
          <path d="M0 0 L 24 0" transform={side < 0 ? 'scale(-1 1)' : undefined} stroke="var(--color-sage-deep)" strokeWidth="0.6" opacity="0.5" />
        </g>
      ))}
      {bloom && (
        <g transform="translate(60 28)">
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse
              key={r}
              cx="0"
              cy="-9"
              rx="6"
              ry="10"
              transform={`rotate(${r})`}
              fill="var(--color-champagne)"
              stroke="var(--color-gold)"
              strokeWidth="0.9"
            />
          ))}
          <circle r="3.5" fill="var(--color-gold)" opacity="0.85" />
        </g>
      )}
    </svg>
  )
}

/** A cluster of sprigs for page corners. */
export function FloralCorner({ className = '', flip = false }) {
  return (
    <div className={`pointer-events-none select-none ${className}`} style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <div className="relative h-full w-full">
        <Sprig className="absolute bottom-0 left-[10%] h-full origin-bottom -rotate-[24deg]" />
        <Sprig className="absolute bottom-0 left-[30%] h-[78%] origin-bottom rotate-[8deg]" bloom={false} />
        <Sprig className="absolute bottom-0 left-0 h-[62%] origin-bottom -rotate-[52deg]" />
      </div>
    </div>
  )
}

export function Divider({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/70 sm:w-20" />
      <svg viewBox="0 0 60 16" className="h-4 w-14" fill="none">
        <path d="M2 8 C 10 1, 18 1, 24 8 C 18 15, 10 15, 2 8 Z" fill="var(--color-sage)" fillOpacity="0.5" stroke="var(--color-sage-deep)" strokeWidth="0.8" />
        <path d="M58 8 C 50 1, 42 1, 36 8 C 42 15, 50 15, 58 8 Z" fill="var(--color-sage)" fillOpacity="0.5" stroke="var(--color-sage-deep)" strokeWidth="0.8" />
        <path d="M30 2 L 34 8 L 30 14 L 26 8 Z" fill="var(--color-gold)" />
      </svg>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/70 sm:w-20" />
    </div>
  )
}

/** Small monogram ring (e.g. "ZM"). */
export function Monogram({ text = 'ZM', className = '' }) {
  return (
    <div className={`relative grid place-items-center rounded-full border border-gold/60 ${className}`} aria-hidden="true">
      <div className="absolute inset-1.5 rounded-full border border-gold/30" />
      <span className="font-serif font-semibold tracking-tight text-ink">{text}</span>
    </div>
  )
}

/** Line-art blossom in the style of the invitation's monogram florals. */
export function LineFlower({ className = '', petals = 8 }) {
  return (
    <svg viewBox="-50 -50 100 100" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        {Array.from({ length: petals }, (_, i) => (
          <path key={i} d="M0 -6 C 10 -16, 10 -34, 0 -42 C -10 -34, -10 -16, 0 -6 Z" fill="var(--color-ivory)" transform={`rotate(${(360 / petals) * i})`} />
        ))}
        {Array.from({ length: petals }, (_, i) => (
          <path key={`i${i}`} d="M0 -6 L0 -26" strokeWidth="0.9" transform={`rotate(${(360 / petals) * i})`} />
        ))}
        <circle r="7" fill="var(--color-ivory)" />
        <circle r="2.5" fill="currentColor" />
      </g>
    </svg>
  )
}

function Leaf({ className = '', style }) {
  return (
    <svg viewBox="0 0 40 80" aria-hidden="true" className={className} style={style}>
      <path d="M20 78 C 20 50, 20 30, 20 6" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M20 40 C 4 34, 2 18, 10 6 C 22 14, 26 28, 20 40 Z" fill="currentColor" />
      <path d="M20 58 C 36 52, 38 38, 32 26 C 20 32, 16 46, 20 58 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/**
 * The invitation's signature monogram: two large serif letters (e.g. Z and M)
 * entwined with line-art florals, each partner's name beneath their letter.
 */
export function InvitationMonogram({ letters = 'ZM', left = '', right = '', className = '' }) {
  const [a = 'Z', b = 'M'] = [...letters]
  return (
    <div className={`mx-auto w-fit select-none ${className}`} role="img" aria-label={`${letters} monogram — ${left} & ${right}`}>
      <div className="relative flex items-end font-serif text-[8.5rem] leading-[0.74] font-bold text-black sm:text-[13rem]" aria-hidden="true">
        <span>{a}</span>
        <span className="-ml-[0.08em]">{b}</span>
        {/* Florals entwined with the letters, as on the printed invitation */}
        <span className="pointer-events-none absolute inset-0 text-black">
          <Leaf className="absolute top-[6%] left-[25%] w-[11%] -rotate-[24deg]" />
          <LineFlower className="absolute top-[34%] left-[15%] w-[27%]" petals={12} />
          <Leaf className="absolute top-[22%] left-[47%] w-[9%] rotate-[18deg]" />
          <LineFlower className="absolute top-[50%] left-[45%] w-[20%]" petals={6} />
        </span>
      </div>
      {(left || right) && (
        <div className="mt-3 flex justify-between px-[6%] font-sans text-[0.7rem] tracking-[0.3em] text-ink uppercase sm:text-xs" aria-hidden="true">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  )
}
