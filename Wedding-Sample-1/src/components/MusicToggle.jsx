import './MusicToggle.css'

// Small floating button that pauses / resumes the background music.
function MusicToggle({ playing, labels, onToggle }) {
  const label = playing ? labels.pause : labels.play

  return (
    <button
      type="button"
      className={`music-toggle${playing ? ' is-playing' : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={playing}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {playing ? (
          // Pause bars
          <path d="M9.5 7v10M14.5 7v10" />
        ) : (
          // Music note
          <>
            <path d="M9.5 17V6.5l9-2V15" />
            <circle cx="7.5" cy="17" r="2" />
            <circle cx="16.5" cy="15" r="2" />
          </>
        )}
      </svg>
    </button>
  )
}

export default MusicToggle
