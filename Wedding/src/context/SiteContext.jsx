import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { defaultContent, defaultSettings } from '../config/defaultContent.js'
import { deepMerge } from '../lib/merge.js'
import { loadPublicSite } from '../services/contentService.js'

const SiteContext = createContext(null)

export function SiteProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const refresh = useCallback(async () => {
    try {
      const data = await loadPublicSite()
      setState({ status: 'ready', data, error: null })
    } catch (error) {
      console.error('[wedding] failed to load site content', error)
      setState({ status: 'error', data: null, error })
    }
  }, [])

  useEffect(() => {
    // Initial load of public content; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  const value = useMemo(() => {
    const row = state.data?.settings
    const settings = { ...defaultSettings, ...(row ?? {}) }
    const content = deepMerge(defaultContent, row?.content ?? {})
    const coupleTitle = `${content.couple.partnerOne} & ${content.couple.partnerTwo}`
    return {
      status: state.status,
      error: state.error,
      // True once the API has answered; guest forms are disabled otherwise.
      connected: state.status === 'ready',
      settingsMissing: state.status === 'ready' && !row,
      settings,
      content,
      events: state.data?.events ?? [],
      albums: state.data?.albums ?? [],
      coupleTitle,
      refresh,
    }
  }, [state, refresh])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useSite() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}
