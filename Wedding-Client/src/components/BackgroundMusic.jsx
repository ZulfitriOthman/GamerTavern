// Background music: one looping <audio> element for the whole page and a small
// floating play/pause button. Playback only ever starts from a real click (the
// "Buka Undangan" button, via the ref, or this button), so autoplay rules are
// respected. Volume fades in and out; iOS ignores volume changes, so there the
// music simply starts and stops.
import { Music, Pause } from 'lucide-react'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'

const SRC = '/audio/wedding-music.mp3'
const VOLUME = 0.35
const FADE_IN_MS = 1800
const FADE_OUT_MS = 700

export function BackgroundMusic({ ref }) {
  const audio = useRef(null)
  const frame = useRef(0)
  const wanted = useRef(false) // latest intent, so a quick play→pause isn't undone by a late play()
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  /** Ramp the volume to `to` over `ms`, then call `done`. Cancels any ramp in progress. */
  const fade = (to, ms, done) => {
    cancelAnimationFrame(frame.current)
    const el = audio.current
    const from = el.volume
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms)
      el.volume = from + (to - from) * t
      if (t < 1) frame.current = requestAnimationFrame(step)
      else done?.()
    }
    frame.current = requestAnimationFrame(step)
  }

  const play = () => {
    const el = audio.current
    if (!el || failed) return
    wanted.current = true
    setPlaying(true)
    if (el.paused) el.volume = 0
    // Called synchronously inside the click handler so mobile browsers accept it.
    el.play().then(
      () => wanted.current && fade(VOLUME, FADE_IN_MS),
      () => {
        // blocked or failed: show the play button again
        wanted.current = false
        setPlaying(false)
      },
    )
  }

  const pause = () => {
    const el = audio.current
    if (!el) return
    wanted.current = false
    setPlaying(false)
    fade(0, FADE_OUT_MS, () => el.pause())
  }

  useImperativeHandle(ref, () => ({ play }))

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <>
      <audio
        ref={audio}
        src={SRC}
        loop
        preload="none"
        hidden
        onError={() => {
          // file missing or unplayable: hide the control rather than show a dead button
          cancelAnimationFrame(frame.current)
          wanted.current = false
          setPlaying(false)
          setFailed(true)
        }}
      />
      {!failed && (
        <button
          type="button"
          onClick={playing ? pause : play}
          aria-label={playing ? 'Jeda muzik' : 'Mainkan muzik'}
          title={playing ? 'Jeda muzik' : 'Mainkan muzik'}
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 grid size-11 cursor-pointer place-items-center rounded-full border border-bronze/60 bg-primary text-ivory shadow-[0_0_0_3px_rgb(250_249_247/0.85),0_8px_20px_-8px_rgb(52_31_41/0.45)] transition duration-300 hover:bg-primary-deep sm:right-6 sm:bottom-6"
        >
          {playing ? <Pause className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Music className="size-4" strokeWidth={1.75} aria-hidden="true" />}
        </button>
      )}
    </>
  )
}
