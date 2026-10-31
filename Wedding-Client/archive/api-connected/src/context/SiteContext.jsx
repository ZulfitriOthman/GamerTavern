// Loads the public site (settings, content, events, albums) once and shares it.
// status: 'loading' | 'ready' | 'error'. On error the site shows a retry notice
// and every form stays disabled — nothing pretends to work without the API.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { defaultContent, defaultSettings } from '../config/content.js'
import { deepMerge } from '../lib/content.js'
import { errorMessage } from '../lib/api.js'
import { getSite } from '../services/publicService.js'

const SiteContext = createContext(null)

export function SiteProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getSite(controller.signal).then(
      (data) => setState({ status: 'ready', data, error: '' }),
      (error) => {
        if (error.name === 'AbortError') return
        console.error('[wedding] site failed to load', error)
        setState({ status: 'error', data: null, error: errorMessage(error) })
      },
    )
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo(() => {
    const raw = state.data?.settings
    const settings = { ...defaultSettings, ...(raw ?? {}) }
    const content = deepMerge(defaultContent, raw?.content)
    return {
      status: state.status,
      error: state.error,
      ready: state.status === 'ready' && Boolean(raw),
      retry,
      settings,
      content,
      locale: content.locale || 'en-GB',
      events: state.data?.events ?? [],
      albums: state.data?.albums ?? [],
    }
  }, [state, retry])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSite() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}
