import { ImageIcon } from 'lucide-react'
import { mediaUrl } from '../../lib/api.js'
import { Sprig } from './Ornaments.jsx'

/** Displays a photo, or an elegant placeholder when none has been added yet. */
export function PhotoFrame({ src, alt = '', className = '', label = 'Photo coming soon', rounded = 'rounded-[2rem]' }) {
  if (src) {
    return (
      <div className={`overflow-hidden bg-cream ${rounded} ${className}`}>
        <img src={mediaUrl(src)} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden border border-champagne bg-gradient-to-br from-cream via-ivory to-sage-soft/60 ${rounded} ${className}`}
      role="img"
      aria-label={label}
    >
      <Sprig className="absolute -bottom-6 -left-6 h-40 -rotate-[30deg] opacity-60" />
      <Sprig className="absolute -top-8 -right-6 h-36 rotate-[150deg] opacity-40" bloom={false} />
      <ImageIcon className="size-7 text-gold/70" strokeWidth={1.2} aria-hidden="true" />
      <span className="mt-2 text-[0.8125rem] tracking-[0.14em] text-muted uppercase">{label}</span>
    </div>
  )
}
