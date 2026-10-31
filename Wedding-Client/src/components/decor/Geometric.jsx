// Islamic-inspired geometric ornaments: the 8-point star (khatam), a repeating
// star band for borders, and a layered pointed-arch (mihrab) frame that looks
// like stacked paper-cut card. Decorative only.
import { useId, useLayoutEffect, useRef, useState } from 'react'

const GREY = '#a59e99'
const BRONZE = 'var(--color-bronze)'

/** Two overlapping squares forming an 8-point star, with an inner ring. */
export function EightPointStar({ className = '', filled = false, title, style }) {
  return (
    <svg viewBox="-12 -12 24 24" style={style} className={`select-none ${className}`} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} focusable="false">
      {title && <title>{title}</title>}
      <g fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.12 : 0} stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round">
        <rect x="-7.5" y="-7.5" width="15" height="15" />
        <rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)" />
      </g>
      <circle r="3.4" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle r="1.1" fill="currentColor" />
    </svg>
  )
}

/** A horizontal border of linked stars and diamonds. Stretches to its container width. */
export function GeometricBand({ className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={`pointer-events-none block h-6 w-full select-none ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}-band`} width="48" height="24" patternUnits="userSpaceOnUse">
          <g transform="translate(24 12)" fill="none" stroke={GREY} strokeOpacity=".7" strokeWidth=".8">
            <rect x="-6" y="-6" width="12" height="12" />
            <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" />
            <circle r="2" stroke={BRONZE} />
          </g>
          <path d="M0 12 L6 7 L12 12 L6 17Z" fill={BRONZE} fillOpacity=".18" stroke={BRONZE} strokeOpacity=".5" strokeWidth=".6" />
          <path d="M33 12 H48 M0 12 H15" stroke={GREY} strokeOpacity=".5" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-band)`} />
    </svg>
  )
}

/** Size of an element in CSS pixels, kept current as it resizes. */
function useSize() {
  const ref = useRef(null)
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

/** Height of the curved head of an arch this size. */
const archHead = (w, h) => Math.min(w * 0.5, h * 0.42)

/**
 * Outline of a pointed arch with a slightly keeled tip, in pixels. Inner
 * arches share the outer arch's `head`, so the layers stay evenly spaced.
 */
function archPath(w, h, inset, head) {
  const l = inset
  const r = w - inset
  const cx = w / 2
  const apex = inset * 1.3
  const spring = head + inset * 0.25
  const rise = spring - apex
  const half = cx - l
  return [
    `M${l} ${h - inset}`,
    `L${l} ${spring}`,
    `C${l} ${spring - rise * 0.56} ${cx - half * 0.5} ${apex + rise * 0.24} ${cx - half * 0.05} ${apex + rise * 0.06}`,
    `L${cx} ${apex}`,
    `L${cx + half * 0.05} ${apex + rise * 0.06}`,
    `C${cx + half * 0.5} ${apex + rise * 0.24} ${r} ${spring - rise * 0.56} ${r} ${spring}`,
    `L${r} ${h - inset}Z`,
  ].join(' ')
}

/**
 * A layered mihrab arch that fills its (relatively positioned) parent: a grey
 * outer band, a raised white arch with a soft paper shadow, and a fine double
 * bronze line with a small star at the apex.
 *
 * `variant="panel"` is a quieter version for section cards. Content sits above
 * it; give the parent enough top padding to clear the curved head.
 */
export function MihrabFrame({ className = '', variant = 'hero' }) {
  const [ref, size] = useSize()
  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      {size?.w > 0 && <MihrabLayers hero={variant === 'hero'} w={size.w} h={size.h} />}
    </div>
  )
}

function MihrabLayers({ hero, w, h }) {
  const id = useId().replace(/:/g, '')
  const head = archHead(w, h)
  const gap = hero ? (w < 480 ? 9 : 13) : 7
  const arch = (n) => archPath(w, h, n, head)
  const line = gap * (hero ? 2.9 : 1.9)
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="absolute inset-0 overflow-visible">
        <defs>
          <filter id={`${id}-paper`} x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#341f29" floodOpacity=".06" />
            <feDropShadow dx="0" dy={hero ? 14 : 8} stdDeviation={hero ? 16 : 10} floodColor="#341f29" floodOpacity={hero ? 0.07 : 0.05} />
          </filter>
          <filter id={`${id}-lift`} x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#341f29" floodOpacity=".09" />
          </filter>
        </defs>

        {/* outer band: soft grey, gives the arch its depth */}
        <path d={arch(0.5)} fill={hero ? 'var(--color-frost)' : 'var(--color-mist)'} stroke="var(--color-haze)" strokeWidth="1" filter={`url(#${id}-paper)`} />
        {/* raised white arch(es) */}
        <path d={arch(gap)} fill="#fdfcfb" stroke="var(--color-haze)" strokeOpacity=".7" strokeWidth=".8" filter={`url(#${id}-lift)`} />
        {hero && <path d={arch(gap * 2)} fill="#ffffff" stroke="var(--color-line)" strokeWidth=".8" filter={`url(#${id}-lift)`} />}
        {/* fine double bronze line */}
        <path d={arch(line)} fill="none" stroke={BRONZE} strokeOpacity=".5" strokeWidth=".8" />
        <path d={arch(line + 4)} fill="none" stroke={BRONZE} strokeOpacity=".22" strokeWidth=".6" />
      </svg>
      <EightPointStar
        className={`absolute left-1/2 -translate-x-1/2 text-bronze ${hero ? 'size-6' : 'size-4'}`}
        filled
        style={{ top: line * 1.3 + (hero ? 18 : 12) }}
      />
    </>
  )
}
