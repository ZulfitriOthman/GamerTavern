import useReveal from '../hooks/useReveal'

// Gold divider whose lines draw outward from the centre when revealed.
function Divider({ delay = 0, immediate = false }) {
  const [ref, visible] = useReveal({ immediate })

  return (
    <svg
      ref={ref}
      className={`divider${visible ? ' is-drawn' : ''}`}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      viewBox="0 0 200 20"
      aria-hidden="true"
      focusable="false"
    >
      <g
        className="divider__lines"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      >
        <path pathLength="1" d="M88 9 C87 3 79 3 74 10 H8" />
        <path pathLength="1" d="M112 11 C113 17 121 17 126 10 H192" />
      </g>
      <g className="divider__gems" fill="currentColor">
        <path d="M100 3 L106 10 L100 17 L94 10 Z" />
        <circle cx="4" cy="10" r="1.6" />
        <circle cx="196" cy="10" r="1.6" />
      </g>
    </svg>
  )
}

export default Divider
