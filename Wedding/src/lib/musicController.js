// Background-music state machine (framework-free, so it can be unit-tested).
// Exactly ONE audio element is ever created, on the first play attempt (autoplay
// on load). It is never in the DOM and loads in the background, so it never
// delays page rendering.
//
// status:     idle (not started) | playing | paused | blocked (browser refused
//             to start without a tap) | error (file failed to load)
// preference: 'on' | 'off' | null (not asked yet) — remembered across visits.

export const MUSIC_SRC_DEFAULT = '/audio/wedding-background.mp3'
export const MUSIC_DEFAULT_VOLUME = 0.3
const PREF_KEY = 'wedding.music'

export function createPreferenceStore(storage = globalThis.localStorage) {
  return {
    get() {
      try {
        const v = storage?.getItem(PREF_KEY)
        return v === 'on' || v === 'off' ? v : null
      } catch {
        return null // private mode / storage blocked
      }
    },
    set(v) {
      try {
        storage?.setItem(PREF_KEY, v)
      } catch {
        // not remembered — still honoured for this visit
      }
    },
  }
}

export function createMusicController({ src = MUSIC_SRC_DEFAULT, createAudio, preferences, volume = MUSIC_DEFAULT_VOLUME } = {}) {
  let audio = null
  let pausedForMedia = false
  let pending = null // the play() in flight, so overlapping attempts share it
  let snapshot = { status: 'idle', preference: preferences.get(), volume, volumeAdjustable: true }
  const listeners = new Set()

  const update = (patch) => {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach((fn) => fn())
  }

  function ensureAudio() {
    if (audio) return audio
    audio = createAudio(src)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = snapshot.volume
    // iOS Safari ignores programmatic volume (hardware buttons only): hide the slider there.
    const volumeAdjustable = Math.abs(audio.volume - snapshot.volume) < 0.01
    // Keep status truthful if the OS or browser pauses/resumes playback (calls, headphones…).
    audio.addEventListener('playing', () => update({ status: 'playing' }))
    audio.addEventListener('pause', () => snapshot.status === 'playing' && update({ status: 'paused' }))
    audio.addEventListener('error', () => update({ status: 'error' }))
    update({ volumeAdjustable })
    return audio
  }

  /** Must be called from a user gesture (click / tap / key) to satisfy autoplay rules. */
  function play() {
    pausedForMedia = false
    if (!pending) pending = attemptPlay().finally(() => (pending = null))
    return pending
  }

  async function attemptPlay() {
    const el = ensureAudio()
    if (!el.paused) {
      update({ status: 'playing' })
      return true
    }
    try {
      await el.play()
      update({ status: 'playing' })
      return true
    } catch (error) {
      // Autoplay refusal is expected browser behaviour, not an error to surface loudly.
      update({ status: error?.name === 'NotAllowedError' ? 'blocked' : 'error' })
      return false
    }
  }

  const controller = {
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    /** Guest chose music (envelope / prompt / control). */
    enable() {
      preferences.set('on')
      update({ preference: 'on' })
      return play()
    },
    /** Guest chose silence, or paused manually: remembered, never auto-resumed. */
    disable() {
      preferences.set('off')
      pausedForMedia = false
      update({ preference: 'off', status: audio ? 'paused' : 'idle' })
      audio?.pause()
    },
    toggle() {
      return snapshot.status === 'playing' ? controller.disable() : controller.enable()
    },
    /**
     * Music is on by default: tried once on page load and, if the browser blocks
     * that, again on the guest's first interaction. Never after they turned it off,
     * and never once it has started this visit (a later pause is theirs to undo).
     */
    autoplay() {
      if (snapshot.preference === 'off' || (snapshot.status !== 'idle' && snapshot.status !== 'blocked')) return Promise.resolve(false)
      return play()
    },
    /** A gallery video started: step aside. */
    pauseForMedia() {
      if (snapshot.status !== 'playing') return
      pausedForMedia = true
      audio.pause()
      update({ status: 'paused' })
    },
    /** The video stopped: come back only if WE paused for it and the guest still wants music. */
    resumeAfterMedia() {
      if (!pausedForMedia || snapshot.preference !== 'on') return Promise.resolve(false)
      return play()
    },
    setVolume(v) {
      const value = Math.min(1, Math.max(0, Number(v) || 0))
      if (audio) audio.volume = value
      update({ volume: value })
    },
    /** For tests / diagnostics: how many audio elements exist (always 0 or 1). */
    _audio: () => audio,
  }
  return controller
}
