// Context and hooks for live inspection updates; the provider is in live.jsx.
import { createContext, use, useEffect, useState } from 'react'

export const LiveContext = createContext(null)

/**
 * A number that changes whenever data on this page may be out of date: any
 * inspection change (or only `inspectionId`'s), an access change, or a
 * reconnect. Add it to a fetch effect's dependencies to refetch.
 * `last` is the event that caused the latest change.
 */
export function useLiveVersion(inspectionId) {
  const live = use(LiveContext)
  const [state, setState] = useState({ version: 0, last: null })
  const wanted = inspectionId == null ? null : Number(inspectionId)

  useEffect(() => {
    if (!live) return undefined
    return live.hub.subscribe((event) => {
      if (event.type === 'inspection' && wanted !== null && event.inspectionId !== wanted) return
      setState((s) => ({ version: s.version + 1, last: event }))
    })
  }, [live, wanted])

  return state
}

/** Connection state for a small indicator: 'connecting' | 'live' | 'offline'. */
export function useLiveStatus() {
  return use(LiveContext)?.status ?? 'offline'
}
