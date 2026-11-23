// Live inspection updates for both prototype apps, over the Backend's
// Socket.IO server: transport path /socket.io (same origin, proxied by Vite),
// namespace /mashoor (Backend/mashoor/src/realtime.js).
//
// Notify-only. The server sends { inspectionId, action, status, self } after
// a committed write; pages refetch through the normal REST API, which applies
// every permission check again. Nothing is written over the socket.
//
// Lifecycle: <LiveProvider> is mounted inside the signed-in layout, so it
// connects for the current session and disconnects (removing its listeners)
// when the user signs out or the session is lost. Each connection attempt —
// including automatic reconnects — first asks the REST API for a single-use
// ticket with the session cookie. After a reconnect every subscriber
// refetches, so nothing missed while offline stays stale. If the server ends
// the socket (logout elsewhere, expiry, deactivation) the session is re-read,
// which sends a signed-out user back to the sign-in page.
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@mashoor/shared/useAuth'
import { LiveContext, useLiveStatus } from './useLive.js'

export function LiveProvider({ api, children }) {
  // Kept in a ref: the auth context's refresh() is a new function on every
  // render, and the socket must not reconnect because of that.
  const { refresh } = useAuth()
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })
  const [hub] = useState(() => {
    const listeners = new Set()
    return {
      listeners,
      subscribe(fn) {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
      publish(event) {
        for (const fn of [...listeners]) fn(event)
      },
    }
  })
  const [status, setStatus] = useState('connecting') // connecting | live | offline

  useEffect(() => {
    let connectedBefore = false
    const socket = io('/mashoor', {
      path: '/socket.io',
      withCredentials: true,
      // Called before every (re)connection attempt: a fresh single-use ticket.
      auth: (cb) => {
        api('/realtime/ticket', { method: 'POST' }).then(
          (t) => cb({ ticket: t.ticket }),
          () => cb({}),
        )
      },
    })

    socket.on('connect', () => {
      setStatus('live')
      if (connectedBefore) hub.publish({ type: 'reconnect' })
      connectedBefore = true
    })
    socket.on('disconnect', (reason) => {
      setStatus('offline')
      // The server ended it: the session is gone or no longer valid.
      if (reason === 'io server disconnect') refreshRef.current()
    })
    socket.on('connect_error', (error) => {
      setStatus('offline')
      // Refused by the server (no valid session): no automatic retry follows.
      if (!socket.active) {
        if (error.message === 'Not signed in.') refreshRef.current()
      }
    })
    socket.on('inspection:changed', (payload) => hub.publish({ type: 'inspection', ...payload }))
    socket.on('access:changed', () => {
      refreshRef.current() // sign-off stages / role may have changed
      hub.publish({ type: 'access' })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [api, hub])

  return <LiveContext value={{ hub, status }}>{children}</LiveContext>
}

const STATUS_TEXT = { live: 'Live updates on', connecting: 'Connecting live updates…', offline: 'Live updates offline — reconnecting' }

export function LiveIndicator() {
  const status = useLiveStatus()
  return (
    <span className={`proto-live proto-live-${status}`} role="status" title={STATUS_TEXT[status]}>
      <span className="proto-live-dot" aria-hidden="true" />
      {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
    </span>
  )
}
