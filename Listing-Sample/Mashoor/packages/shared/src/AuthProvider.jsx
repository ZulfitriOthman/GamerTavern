import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { UNAUTHORIZED_EVENT } from './api.js'
import { Loading } from './ui.jsx'
import { AuthContext, useAuth } from './useAuth.js'

// `session` is whatever the API's /auth/me and /auth/login return
// (staff: { user }, vendor: { user, company }).
export function AuthProvider({ api, children }) {
  // signedOut: the user just pressed "Sign out" (so no return-to page is kept).
  const [state, setState] = useState({ loading: true, session: null, signedOut: false })

  useEffect(() => {
    let cancelled = false
    api('/auth/me').then(
      (session) => !cancelled && setState({ loading: false, session }),
      () => !cancelled && setState({ loading: false, session: null }),
    )
    const onUnauthorized = () => setState({ loading: false, session: null, signedOut: false })
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [api])

  // credentials: { email, password } for staff, { username, password } for vendors.
  async function login(credentials) {
    const session = await api('/auth/login', { method: 'POST', body: credentials })
    setState({ loading: false, session, signedOut: false })
  }

  // Re-reads the current session from the API.
  async function refresh() {
    try {
      setState({ loading: false, session: await api('/auth/me'), signedOut: false })
    } catch {
      // a 401 already resets the session via UNAUTHORIZED_EVENT
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setState({ loading: false, session: null, signedOut: true })
  }

  return <AuthContext value={{ ...state, login, logout, refresh }}>{children}</AuthContext>
}

// Protected routes. When someone without a session opens a protected page (a deep
// link, or their session expired), that page is remembered so sign-in can return
// to it. After a deliberate "Sign out" nothing is remembered: the next sign-in
// goes to the app's default page, not to wherever the user happened to be.
export function RequireAuth({ children }) {
  const { loading, session, signedOut } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="page-status">
        <Loading />
      </div>
    )
  }
  if (!session) {
    const from = location.pathname + location.search + location.hash
    return <Navigate to="/login" replace state={signedOut ? null : { from }} />
  }
  return children
}
