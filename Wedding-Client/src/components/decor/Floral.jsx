// Botanical ornaments drawn in SVG (original artwork): burgundy roses, dusty
// mauve blossoms and buds on thin natural branches with muted brown leaves and
// berries. Purely decorative (aria-hidden).
import { useId } from 'react'

const BRANCH = 'var(--color-leaf-deep)'

/** Shared gradients, namespaced so several ornaments can live on one page. */
function Defs({ id }) {
  return (
    <defs>
      <radialGradient id={`${id}-burg`} cx="50%" cy="62%" r="72%">
        <stop offset="0%" stopColor="#8d3c58" />
        <stop offset="55%" stopColor="#6a2139" />
        <stop offset="100%" stopColor="#481324" />
      </radialGradient>
      <radialGradient id={`${id}-mauve`} cx="50%" cy="60%" r="75%">
        <stop offset="0%" stopColor="#ecd9e0" />
        <stop offset="60%" stopColor="#c99aac" />
        <stop offset="100%" stopColor="#a66d83" />
      </radialGradient>
      <linearGradient id={`${id}-leaf`} x1="0" x2="1">
        <stop offset="0%" stopColor="#bba697" />
        <stop offset="100%" stopColor="#7f6758" />
      </linearGradient>
    </defs>
  )
}

/** A layered rose seen from above. `tone` is 'burg' (burgundy) or 'mauve'. */
function Rose({ id, x, y, r, tone = 'burg', rotate = 0 }) {
  const fill = `url(#${id}-${tone})`
  const edge = tone === 'burg' ? '#3a0e1c' : '#7e4a5e'
  const ring = (count, dist, rx, ry, offset) =>
    Array.from({ length: count }, (_, i) => {
      const a = (360 / count) * i + offset
      const rad = (a * Math.PI) / 180
      const px = Math.cos(rad) * dist
      const py = Math.sin(rad) * dist
      return <ellipse key={`${dist}-${i}`} cx={px} cy={py} rx={rx} ry={ry} transform={`rotate(${a + 90} ${px} ${py})`} fill={fill} stroke={edge} strokeOpacity=".3" strokeWidth=".6" />
    })
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {ring(6, r * 0.52, r * 0.5, r * 0.4, 0)}
      {ring(5, r * 0.3, r * 0.36, r * 0.3, 30)}
      {ring(4, r * 0.13, r * 0.24, r * 0.2, 60)}
      <path d={`M${-r * 0.1} 0 a${r * 0.1} ${r * 0.1} 0 1 1 ${r * 0.2} 0 a${r * 0.16} ${r * 0.16} 0 1 1 ${-r * 0.3} ${r * 0.04}`} fill="none" stroke={edge} strokeOpacity=".55" strokeWidth=".7" />
    </g>
  )
}

/** A small five-petal blossom with a bronze centre. */
function Blossom({ id, x, y, s, rotate = 0, tone = 'mauve' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy={-s * 0.55} rx={s * 0.36} ry={s * 0.55} transform={`rotate(${a})`} fill={`url(#${id}-${tone})`} stroke="#7e4a5e" strokeOpacity=".3" strokeWidth=".5" />
      ))}
      <circle r={s * 0.22} fill="var(--color-bronze)" />
    </g>
  )
}

/** Slender leaf with a midrib, lying along `angle` (degrees). */
function Leaf({ id, x, y, len, angle, light = false }) {
  const w = len * 0.24
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 Q${len * 0.42} ${-w} ${len} 0 Q${len * 0.5} ${w} 0 0Z`} fill={light ? '#ddd1c8' : `url(#${id}-leaf)`} stroke={BRANCH} strokeOpacity=".35" strokeWidth=".45" />
      <path d={`M${len * 0.05} 0 L${len * 0.85} 0`} stroke={BRANCH} strokeOpacity=".4" strokeWidth=".45" />
    </g>
  )
}

/** A closed bud pointing along `angle` (0 = up). */
function Bud({ id, x, y, s, angle, tone = 'burg' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 L0 ${-s * 0.4}`} stroke={BRANCH} strokeWidth=".8" />
      <path d={`M0 ${-s * 1.25} C${s * 0.5} ${-s * 0.9} ${s * 0.42} ${-s * 0.35} 0 ${-s * 0.3} C${-s * 0.42} ${-s * 0.35} ${-s * 0.5} ${-s * 0.9} 0 ${-s * 1.25}Z`} fill={`url(#${id}-${tone})`} stroke="#3a0e1c" strokeOpacity=".3" strokeWidth=".5" />
      <path d={`M0 ${-s * 0.3} Q${-s * 0.4} ${-s * 0.45} ${-s * 0.3} ${-s * 0.8} M0 ${-s * 0.3} Q${s * 0.4} ${-s * 0.45} ${s * 0.3} ${-s * 0.8}`} fill="none" stroke={BRANCH} strokeWidth=".8" />
    </g>
  )
}

/** Clusters of tiny berries in burgundy and bronze. */
function Berries({ points }) {
  return points.map(([x, y, r = 2.2], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 2 ? 'var(--color-bronze)' : '#6a2139'} fillOpacity=".85" />)
}

/**
 * A floral arrangement for a corner. Drawn for the top-left; `position`
 * mirrors it for the other corners.
 */
export function FloralCorner({ position = 'top-left', className = '', size = 'w-40 sm:w-56' }) {
  const id = useId().replace(/:/g, '')
  const flip = {
    'top-left': '',
    'top-right': '-scale-x-100',
    'bottom-left': '-scale-y-100',
    'bottom-right': '-scale-100',
  }[position]
  return (
    <svg viewBox="0 0 240 240" className={`pointer-events-none select-none ${size} ${flip} ${className}`} aria-hidden="true" focusable="false">
      <Defs id={id} />
      {/* branches along the two edges, and short twigs */}
      <g fill="none" stroke={BRANCH} strokeLinecap="round">
        <path d="M8 44 C 60 32, 120 22, 236 8" strokeOpacity=".6" strokeWidth="1.1" />
        <path d="M44 8 C 32 60, 22 120, 8 236" strokeOpacity=".6" strokeWidth="1.1" />
        <path d="M118 25 C 140 36, 162 44, 194 46" strokeOpacity=".5" strokeWidth=".8" />
        <path d="M25 118 C 36 140, 44 162, 46 194" strokeOpacity=".5" strokeWidth=".8" />
        <path d="M70 72 C 92 92, 108 110, 124 138" strokeOpacity=".5" strokeWidth=".8" />
      </g>
      {/* leaves */}
      <Leaf id={id} x={92} y={31} len={30} angle={-32} />
      <Leaf id={id} x={128} y={27} len={26} angle={28} light />
      <Leaf id={id} x={150} y={21} len={30} angle={-12} />
      <Leaf id={id} x={176} y={17} len={24} angle={-42} light />
      <Leaf id={id} x={204} y={12} len={26} angle={4} />
      <Leaf id={id} x={160} y={42} len={20} angle={24} light />
      <Leaf id={id} x={31} y={92} len={30} angle={122} />
      <Leaf id={id} x={27} y={128} len={26} angle={62} light />
      <Leaf id={id} x={21} y={150} len={30} angle={102} />
      <Leaf id={id} x={17} y={176} len={24} angle={132} light />
      <Leaf id={id} x={12} y={204} len={26} angle={86} />
      <Leaf id={id} x={42} y={160} len={20} angle={66} light />
      <Leaf id={id} x={96} y={98} len={20} angle={10} />
      {/* blooms */}
      <Rose id={id} x={62} y={62} r={36} rotate={10} />
      <Rose id={id} x={118} y={38} r={21} tone="mauve" rotate={40} />
      <Rose id={id} x={38} y={118} r={19} tone="mauve" rotate={-20} />
      <Blossom id={id} x={148} y={40} s={8} rotate={20} />
      <Blossom id={id} x={40} y={148} s={8} rotate={-10} />
      <Blossom id={id} x={190} y={30} s={6} />
      <Blossom id={id} x={30} y={190} s={6} rotate={30} />
      <Blossom id={id} x={98} y={78} s={7} rotate={14} />
      <Bud id={id} x={222} y={10} s={11} angle={80} />
      <Bud id={id} x={10} y={222} s={11} angle={190} />
      <Bud id={id} x={194} y={46} s={8} angle={110} tone="mauve" />
      <Bud id={id} x={46} y={194} s={8} angle={160} tone="mauve" />
      <Berries points={[[112, 112], [120, 124, 2], [126, 137, 1.8], [114, 128, 1.6], [168, 56, 1.6], [56, 168, 1.6], [176, 52, 1.4]]} />
    </svg>
  )
}

/**
 * A low spray that sits on the bottom edge of an invitation: a burgundy rose
 * in the centre, mauve roses beside it and branches trailing either side.
 */
export function FloralGarland({ className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 360 110" className={`pointer-events-none select-none ${className}`} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <g fill="none" stroke={BRANCH} strokeLinecap="round" strokeOpacity=".6">
        <path d="M180 82 C 140 90, 90 96, 6 88" strokeWidth="1" />
        <path d="M180 82 C 220 90, 270 96, 354 88" strokeWidth="1" />
        <path d="M150 74 C 126 58, 104 50, 74 48" strokeWidth=".8" />
        <path d="M210 74 C 234 58, 256 50, 286 48" strokeWidth=".8" />
      </g>
      <Leaf id={id} x={120} y={88} len={26} angle={190} />
      <Leaf id={id} x={92} y={93} len={24} angle={160} light />
      <Leaf id={id} x={60} y={93} len={24} angle={196} />
      <Leaf id={id} x={34} y={91} len={20} angle={166} light />
      <Leaf id={id} x={240} y={88} len={26} angle={-10} />
      <Leaf id={id} x={268} y={93} len={24} angle={20} light />
      <Leaf id={id} x={300} y={93} len={24} angle={-16} />
      <Leaf id={id} x={326} y={91} len={20} angle={14} light />
      <Leaf id={id} x={118} y={56} len={20} angle={-160} />
      <Leaf id={id} x={242} y={56} len={20} angle={-20} />
      <Leaf id={id} x={160} y={60} len={22} angle={-130} light />
      <Leaf id={id} x={200} y={60} len={22} angle={-50} light />
      <Rose id={id} x={180} y={76} r={30} rotate={12} />
      <Rose id={id} x={140} y={84} r={18} tone="mauve" rotate={30} />
      <Rose id={id} x={220} y={84} r={18} tone="mauve" rotate={-10} />
      <Blossom id={id} x={108} y={72} s={7} rotate={10} />
      <Blossom id={id} x={252} y={72} s={7} rotate={-20} />
      <Blossom id={id} x={80} y={86} s={5.5} />
      <Blossom id={id} x={280} y={86} s={5.5} rotate={36} />
      <Bud id={id} x={74} y={48} s={9} angle={-80} />
      <Bud id={id} x={286} y={48} s={9} angle={80} />
      <Bud id={id} x={8} y={88} s={8} angle={-96} tone="mauve" />
      <Bud id={id} x={352} y={88} s={8} angle={96} tone="mauve" />
      <Berries points={[[164, 46, 2], [172, 40, 1.8], [196, 44, 2], [188, 38, 1.6], [180, 34, 1.5]]} />
    </svg>
  )
}

/** Horizontal floral divider: a small rose with leaves and blossoms either side. */
export function FloralDivider({ className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 260 40" className={`pointer-events-none mx-auto h-9 w-56 select-none sm:w-64 ${className}`} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <path d="M10 20 H96 M164 20 H250" stroke="var(--color-bronze)" strokeOpacity=".5" strokeWidth=".8" />
      <path d="M10 20 l4 -3 l4 3 l-4 3Z M242 20 l4 -3 l4 3 l-4 3Z" fill="var(--color-bronze)" fillOpacity=".55" />
      <Leaf id={id} x={118} y={20} len={20} angle={200} />
      <Leaf id={id} x={118} y={20} len={17} angle={164} light />
      <Leaf id={id} x={142} y={20} len={20} angle={-20} />
      <Leaf id={id} x={142} y={20} len={17} angle={16} light />
      <Blossom id={id} x={104} y={16} s={4.5} />
      <Blossom id={id} x={156} y={25} s={4.5} rotate={30} />
      <Rose id={id} x={130} y={20} r={12} />
      <Berries points={[[98, 24, 1.4], [162, 15, 1.4]]} />
    </svg>
  )
}

/** A single trailing sprig, e.g. on photo placeholders or under cards. */
export function Sprig({ className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 120 60" className={`pointer-events-none select-none ${className}`} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <path d="M4 54 C 30 48, 60 32, 112 10" fill="none" stroke={BRANCH} strokeOpacity=".6" strokeWidth=".9" />
      <Leaf id={id} x={26} y={49} len={18} angle={-62} />
      <Leaf id={id} x={42} y={44} len={18} angle={12} light />
      <Leaf id={id} x={60} y={35} len={17} angle={-72} light />
      <Leaf id={id} x={76} y={27} len={16} angle={2} />
      <Blossom id={id} x={52} y={38} s={6} />
      <Blossom id={id} x={88} y={20} s={5} rotate={30} />
      <Bud id={id} x={110} y={11} s={9} angle={70} />
      <Berries points={[[18, 50, 1.6], [70, 26, 1.4]]} />
    </svg>
  )
}
