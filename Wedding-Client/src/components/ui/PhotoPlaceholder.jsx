import { Sprig } from '../decor/Floral.jsx'

// Soft tonal plates in the site's palette (ivory, soft grey, a hint of mauve), cycled by `tone`.
const TONES = [
  'from-[#f6f1f2] via-[#fdfcfb] to-[#ebe6e7]',
  'from-[#efeeec] via-[#fbfaf9] to-[#e3e1de]',
  'from-[#f4eef0] via-[#fefdfc] to-[#e8e2e3]',
  'from-[#f1f0ee] via-[#fcfbfa] to-[#e6e5e3]',
]

/**
 * Stands in for a photo until the real file is added (see public/images/wedding/README.md).
 * `label` names the photo slot so it's clear which file goes where.
 */
export function PhotoPlaceholder({ label, tone = 0, className = '', rounded = 'rounded-sm', style }) {
  return (
    <div
      role="img"
      aria-label={label ? `Gambar contoh: ${label}` : 'Gambar contoh'}
      style={style}
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${TONES[tone % TONES.length]} ${rounded} ${className}`}
    >
      <div className="absolute inset-3 border border-bronze/20" style={{ borderRadius: 'inherit' }} aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <Sprig className="w-20 opacity-80" />
        {label && <span className="font-display text-[0.62rem] tracking-[0.28em] text-muted uppercase">{label}</span>}
      </div>
    </div>
  )
}
