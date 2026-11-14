import { createContext, use } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  return use(AuthContext)
}
