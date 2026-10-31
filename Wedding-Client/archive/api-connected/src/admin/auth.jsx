// Admin session state. The API is the only authority: the session lives in an
// HttpOnly cookie, and any 401 from an admin call drops back to the login page.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { errorMessage } from '../lib/api.js'
import * as adminService from '../services/adminService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // status: 'checking' | 'signed-out' | 'signed-in' | 'unreachable'
  const [state, setState] = useState({ status: 'checking', admin: null, error: '' })

  const load = useCallback(
    () =>
      adminService.getSession().then(
        (admin) => setState({ status: admin ? 'signed-in' : 'signed-out', admin, error: '' }),
        (error) => setState({ status: 'unreachable', admin: null, error: errorMessage(error) }),
      ),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const check = useCallback(() => {
    setState({ status: 'checking', admin: null, error: '' })
    load()
  }, [load])

  const login = useCallback(async (email, password) => {
    const admin = await adminService.login(email, password)
    setState({ status: 'signed-in', admin, error: '' })
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminService.logout()
    } finally {
      setState({ status: 'signed-out', admin: null, error: '' })
    }
  }, [])

  /** Runs an admin call; a 401 (expired session) signs the admin out. */
  const guard = useCallback(async (fn) => {
    try {
      return await fn()
    } catch (error) {
      if (error?.status === 401) setState({ status: 'signed-out', admin: null, error: 'Your session has ended. Please sign in again.' })
      throw error
    }
  }, [])

  const value = useMemo(() => ({ ...state, check, login, logout, guard }), [state, check, login, logout, guard])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

/** useAsync for admin endpoints (401-aware). */
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAsync(fn, deps = []) {
  const { guard } = useAuth()
  return useAsync(() => guard(fn), deps)
}

/**
 * Wraps a write action with busy/error/notice state.
 * `run(fn, successMessage)` resolves to the result, or undefined on failure.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAction() {
  const { guard } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const run = useCallback(
    async (fn, successMessage) => {
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const result = await guard(fn)
        if (successMessage) setNotice(successMessage)
        return result ?? true
      } catch (e) {
        setError(errorMessage(e))
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [guard],
  )
  return { busy, error, notice, run, setError, setNotice }
}
