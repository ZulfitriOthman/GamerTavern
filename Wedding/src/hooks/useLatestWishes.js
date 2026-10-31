import { useCallback, useEffect, useRef, useState } from 'react'
import { listApprovedGreetings } from '../services/greetingsService.js'

const REFRESH_MS = 60_000

/**
 * The newest `limit` published wishes, kept fresh without a page reload:
 * fetched on mount, then quietly re-fetched every minute while the tab is
 * visible and whenever the guest returns to it (one request at a time — no
 * retry loops). A failed background refresh keeps the wishes already shown.
 */
export function useLatestWishes(limit, { enabled = true } = {}) {
  const [state, setState] = useState({ items: [], loading: enabled, error: null })
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (!enabled || inFlight.current) return
    inFlight.current = true
    try {
      const { items } = await listApprovedGreetings(0, { limit })
      const seen = new Set()
      const unique = items.filter((w) => !seen.has(w.id) && seen.add(w.id)) // no duplicate React keys
      setState({ items: unique.slice(0, limit), loading: false, error: null })
    } catch (error) {
      setState((s) => ({ items: s.items, loading: false, error: s.items.length ? null : error }))
    } finally {
      inFlight.current = false
    }
  }, [limit, enabled])

  useEffect(() => {
    if (!enabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const refreshIfVisible = () => document.visibilityState === 'visible' && load()
    const timer = setInterval(refreshIfVisible, REFRESH_MS)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [load, enabled])

  return { ...state, reload: load }
}
