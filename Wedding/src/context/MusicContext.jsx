import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createMusicController, createPreferenceStore, MUSIC_SRC_DEFAULT } from '../lib/musicController.js'

const MusicContext = createContext(null)

/**
 * Provides the site's ONE background-music player. Mounted at the app root
 * (outside the router), so it survives every page change.
 */
export function MusicProvider({ children, src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${MUSIC_SRC_DEFAULT}` }) {
  const [controller] = useState(() =>
    createMusicController({
      src,
      preferences: createPreferenceStore(),
      createAudio: (url) => {
        const audio = new Audio(url)
        if ('mediaSession' in navigator && 'MediaMetadata' in window) {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: "Can't Help Falling in Love",
            artist: 'Welder Dias (piano cover)',
            album: 'Zulfitri & Mariah',
          })
        }
        return audio
      },
    }),
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  // Autoplay by default: one attempt as the site loads (once per visit — the
  // provider sits above the router, so page changes never retry it).
  useEffect(() => {
    controller.autoplay()
  }, [controller])

  // If the browser blocked that, start on the guest's first real interaction.
  // Only events browsers accept as user activation (click / touchend / key) —
  // no muted-autoplay tricks. The listeners go away as soon as music plays or
  // the guest turns it off. Taps on the music controls themselves are left to them.
  useEffect(() => {
    if (state.preference === 'off' || (state.status !== 'idle' && state.status !== 'blocked')) return
    const onInteraction = (event) => {
      if (event.target?.closest?.('[data-music-control]')) return
      controller.autoplay()
    }
    const events = ['click', 'touchend', 'keydown']
    events.forEach((type) => document.addEventListener(type, onInteraction, true))
    return () => events.forEach((type) => document.removeEventListener(type, onInteraction, true))
  }, [controller, state.preference, state.status])

  return <MusicContext.Provider value={{ ...state, controller }}>{children}</MusicContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useMusic() {
  return useContext(MusicContext)
}
