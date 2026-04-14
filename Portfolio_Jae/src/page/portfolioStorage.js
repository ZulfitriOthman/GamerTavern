import { connectAdminSocket, disconnectAdminSocket } from '../socket/adminSocket'

const AUTH_TOKEN_KEY = 'jae_portfolio_token'
const AUTH_USER_KEY = 'jae_portfolio_user'
const OVERRIDES_KEY = 'jae_portfolio_overrides'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:3002'
}

function getAdminEmailAllowlist() {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isAdminUser(user) {
  const email = String(user?.EMAIL || user?.email || '').trim().toLowerCase()
  if (!email) {
    return false
  }

  const allowlist = getAdminEmailAllowlist()
  if (allowlist.length === 0) {
    // Safe default for template usage when env is not set.
    return email === 'jae@example.com'
  }

  return allowlist.includes(email)
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAdminAuthenticated() {
  const user = getAuthUser()
  return isAuthenticated() && isAdminUser(user)
}

export async function login(email, password) {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload?.token) {
    throw new Error(payload?.message || 'Login failed')
  }

  if (!isAdminUser(payload.user)) {
    throw new Error('This account is not authorized for admin access.')
  }

  localStorage.setItem(AUTH_TOKEN_KEY, payload.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user || null))
  connectAdminSocket(payload.token)

  return payload
}

export function logout() {
  disconnectAdminSocket()
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export function getPortfolioOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function savePortfolioOverrides(overrides) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
}
