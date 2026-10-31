import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSession, signIn as apiSignIn, signOut as apiSignOut } from '../services/adminService.js'

const AuthContext = createContext(null)

// status: 'loading' | 'signed-out' | 'admin' | 'unavailable' (API unreachable)
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [status, setStatus] = useState('loading')

  const check = useCallback(async () => {
    try {
      // The session lives in an HttpOnly cookie; the server says whether it is valid.
      const current = await getSession()
      setAdmin(current)
      setStatus(current ? 'admin' : 'signed-out')
    } catch (error) {
      setAdmin(null)
      setStatus(error.name === 'TypeError' || error.status >= 500 || error.status === 404 || error.code === 'INVALID_RESPONSE' ? 'unavailable' : 'signed-out')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check()
  }, [check])

  const signIn = useCallback(async (email, password) => {
    const a = await apiSignIn(email, password)
    setAdmin(a)
    setStatus('admin')
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => {})
    setAdmin(null)
    setStatus('signed-out')
  }, [])

  const value = useMemo(() => ({ status, user: admin, signIn, signOut, recheck: check }), [status, admin, signIn, signOut, check])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
