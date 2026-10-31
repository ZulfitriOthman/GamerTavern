import { useCallback, useEffect, useState } from 'react'

/** Runs an async loader on mount (and when `deps` change). Returns { data, error, loading, reload }. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    loader().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) => {
        console.error(error)
        if (!cancelled) setState({ data: null, error, loading: false })
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
