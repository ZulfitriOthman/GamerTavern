import './FloatingPetals.css'

// Fixed, hand-placed values so nothing is randomised on render.
const AMBIENT = [
  { x: '8%', size: 14, duration: 19, delay: -2, drift: 40, spin: 220 },
  { x: '41%', size: 12, duration: 22, delay: -9, drift: 50, spin: 260 },
  { x: '78%', size: 13, duration: 20, delay: -14, drift: 30, spin: 200 },
  { x: '60%', size: 9, duration: 26, delay: -5, drift: -40, spin: -240 },
  { x: '22%', size: 10, duration: 24, delay: -17, drift: -30, spin: -180 },
  { x: '92%', size: 10, duration: 23, delay: -11, drift: -25, spin: -200 },
  { x: '31%', size: 11, duration: 25, delay: -20, drift: 35, spin: 210 },
  { x: '70%', size: 12, duration: 21, delay: -7, drift: -35, spin: -230 },
]

// Petals that scatter from the seam as the cover opens (dx/dy in vmin).
const BURST = [
  { x: '48%', y: '38%', size: 15, delay: 0, dx: -34, dy: 30, spin: -220 },
  { x: '51%', y: '46%', size: 12, delay: 60, dx: 30, dy: 38, spin: 260 },
  { x: '47%', y: '55%', size: 13, delay: 120, dx: -26, dy: 34, spin: 180 },
  { x: '52%', y: '30%', size: 11, delay: 90, dx: 38, dy: 24, spin: -200 },
  { x: '49%', y: '62%', size: 10, delay: 180, dx: 20, dy: 30, spin: 240 },
  { x: '50%', y: '22%', size: 12, delay: 150, dx: -40, dy: 36, spin: 200 },
]

function PetalShape() {
  return (
    <svg viewBox="0 0 12 18" focusable="false">
      <path d="M6 0 C11 4 12 12 6 18 C0 12 1 4 6 0Z" fill="currentColor" />
      <path
        d="M6 2 C8.5 5 9 10 6 15 C5 10 5 5 6 2Z"
        fill="#ffffff"
        opacity=".35"
      />
    </svg>
  )
}

function FloatingPetals({ variant = 'ambient' }) {
  const petals = variant === 'burst' ? BURST : AMBIENT

  return (
    <div className={`petals petals--${variant}`} aria-hidden="true">
      {petals.map((p, index) => (
        <span
          key={index}
          className="petal"
          style={{
            '--x': p.x,
            '--y': p.y,
            '--size': `${p.size}px`,
            '--duration': `${p.duration}s`,
            '--delay': variant === 'burst' ? `${p.delay}ms` : `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--dx': p.dx,
            '--dy': p.dy,
            '--spin': `${p.spin}deg`,
          }}
        >
          <span className="petal__sway">
            <PetalShape />
          </span>
        </span>
      ))}
    </div>
  )
}

export default FloatingPetals
