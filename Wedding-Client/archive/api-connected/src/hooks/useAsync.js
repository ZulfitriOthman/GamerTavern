import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/api.js'

/**
 * Runs `fn` on mount and whenever `deps` change.
 * Returns { data, error, loading, reload, setData }.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: '', loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const run = useRef(0)

  const reload = useCallback(() => {
    const id = ++run.current
    setState((s) => ({ ...s, loading: true, error: '' }))
    Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => id === run.current && setState({ data, error: '', loading: false }),
        (error) => id === run.current && setState((s) => ({ ...s, error: errorMessage(error), loading: false })),
      )
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps)

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])
  return { ...state, reload, setData }
}

/** Reads/writes sessionStorage safely (private mode, blocked storage). */
export function sessionFlag(key, value) {
  try {
    if (value === undefined) return window.sessionStorage.getItem(key)
    window.sessionStorage.setItem(key, value)
  } catch {
    return null
  }
  return value
}
