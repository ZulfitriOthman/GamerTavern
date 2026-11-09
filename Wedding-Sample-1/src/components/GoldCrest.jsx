// Small gold branch flourish around a lavender blossom.
const LEAVES = [
  [67, 37, -152],
  [57, 39, 160],
  [46, 36, -146],
  [36, 33, 172],
  [25, 28, -128],
]

function Branch({ mirrored }) {
  return (
    <g transform={mirrored ? 'translate(160 0) scale(-1 1)' : undefined}>
      <path
        d="M78 35 C66 41 50 41 36 33 C28 28 20 28 15 33 C12 36 13 40 17 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {LEAVES.map(([x, y, angle]) => (
        <path
          key={`${x}-${y}`}
          d="M0 0 C3 -3.2 7 -3.2 10 0 C7 3.2 3 3.2 0 0Z"
          fill="currentColor"
          transform={`translate(${x} ${y}) rotate(${angle})`}
        />
      ))}
    </g>
  )
}

function GoldCrest({ className = '' }) {
  return (
    <svg
      className={`crest ${className}`}
      viewBox="0 0 160 52"
      aria-hidden="true"
      focusable="false"
    >
      <Branch />
      <Branch mirrored />
      <g fill="#b89bd6" stroke="#8e6bb8" strokeWidth=".5">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse
            key={angle}
            cx="80"
            cy="21"
            rx="3.8"
            ry="6.2"
            transform={`rotate(${angle} 80 27)`}
          />
        ))}
      </g>
      <circle cx="80" cy="27" r="2.8" fill="currentColor" />
      <g fill="currentColor">
        <circle cx="80" cy="8" r="1.3" />
        <circle cx="72" cy="11" r=".9" />
        <circle cx="88" cy="11" r=".9" />
      </g>
    </svg>
  )
}

export default GoldCrest
