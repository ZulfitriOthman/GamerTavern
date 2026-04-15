import { connectAdminSocket, disconnectAdminSocket } from '../socket/adminSocket'

const AUTH_TOKEN_KEY = 'jae_portfolio_token'
const AUTH_USER_KEY = 'jae_portfolio_user'
const OVERRIDES_KEY = 'jae_portfolio_overrides'
const PORTFOLIO_ROLE = 'PORTFOLIO'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:3002'
}

function toApiError(error, fallbackMessage) {
  if (error instanceof TypeError) {
    return new Error('Unable to reach the backend API. Please start the server and try again.')
  }

  return error instanceof Error ? error : new Error(fallbackMessage)
}

function isAdminUser(user) {
  const role = String(user?.ROLE || user?.role || '').trim().toUpperCase()
  return role === PORTFOLIO_ROLE
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

async function authenticate(email, password, { requireAdmin = false } = {}) {
  try {
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

    if (requireAdmin && !isAdminUser(payload.user)) {
      throw new Error('This account is not authorized for admin access.')
    }

    localStorage.setItem(AUTH_TOKEN_KEY, payload.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user || null))

    return payload
  } catch (error) {
    throw toApiError(error, 'Login failed')
  }
}

export async function loginAdmin(email, password) {
  const payload = await authenticate(email, password, { requireAdmin: true })

  if (!isAdminUser(payload.user)) {
    logout()
    throw new Error('This account is not authorized for admin access.')
  }

  connectAdminSocket(payload.token)

  return payload
}

export async function loginClient(email, password) {
  return authenticate(String(email || '').trim().toLowerCase(), String(password || ''))
}

export async function registerClient({ email, name, password, phone }) {
  const safePayload = {
    email: String(email || '').trim().toLowerCase(),
    name: String(name || '').trim(),
    password: String(password || ''),
    phone: phone ? String(phone).trim() : '',
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safePayload),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok || !payload?.token) {
      throw new Error(payload?.message || 'Sign up failed')
    }

    localStorage.setItem(AUTH_TOKEN_KEY, payload.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user || null))

    return payload
  } catch (error) {
    throw toApiError(error, 'Sign up failed')
  }
}

export async function submitClientPortfolio(formData) {
  const token = getAuthToken()
  const response = await fetch(`${getApiBaseUrl()}/api/client-portfolio/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || 'Submission failed')
  }

  return payload.submission
}

export async function fetchClientSubmissions() {
  const token = getAuthToken()
  const response = await fetch(`${getApiBaseUrl()}/api/client-portfolio/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || 'Unable to load submissions')
  }

  return payload.submissions || []
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
