// Thin client for the wedding API (Wedding/server). The browser never talks
// to MySQL directly and holds no secrets: admin auth is an HttpOnly cookie,
// plus a CSRF token kept in memory for state-changing admin requests.

/**
 * Where the wedding API lives — the ONE place the frontend decides this.
 *   VITE_API_BASE = backend ORIGIN only, e.g. https://backend.nanashicollectibles.com
 *                   (set in .env.production; embedded into the bundle at build time)
 *   unset         = same origin as the page (dev server proxies /api → Wedding/server)
 * Every request goes to `${origin}/api/wedding/<endpoint>`.
 */
export const WEDDING_API_PATH = '/api/wedding'

export function resolveApiBase(origin) {
  const clean = String(origin ?? '')
    .trim()
    .replace(/\/+$/, '')
    // Tolerate a base that already includes the API path, e.g. ".../api" or ".../api/wedding".
    .replace(/\/api(\/wedding)?$/, '')
  return `${clean}${WEDDING_API_PATH}`
}

export const API_BASE = resolveApiBase(import.meta.env?.VITE_API_BASE)

let csrfToken = ''
export const setCsrfToken = (token) => {
  csrfToken = token || ''
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || `Request failed (${status})`)
    this.status = status
    this.code = code
    // Server messages are written for guests; generic ones replace internal errors.
    this.userMessage = message
  }
}

// Shown when something other than the wedding API answered — e.g. a static
// host returning index.html for /api/* because the API is not routed there.
const UNREACHABLE = 'The website could not reach its server. Please try again in a moment.'

/**
 * Every successful wedding-API response is a JSON object with `success: true`.
 * Anything else on a 2xx status (an HTML page, empty body, plain text) is NOT
 * treated as data: it raises INVALID_RESPONSE so callers show an error instead
 * of reading fields off an empty object.
 */
export function parse(status, text) {
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const isEnvelope = body !== null && typeof body === 'object' && !Array.isArray(body)
  if (status >= 200 && status < 300) {
    if (isEnvelope && body.success === true) return body
    if (isEnvelope && body.success === false) throw new ApiError(status, body.code, body.message)
    throw new ApiError(status, 'INVALID_RESPONSE', UNREACHABLE)
  }
  if (!isEnvelope) throw new ApiError(status, status === 404 ? 'NOT_FOUND' : 'BAD_GATEWAY', status === 404 ? 'Not found.' : UNREACHABLE)
  throw new ApiError(status, body.code, body.message || (status === 404 ? 'Not found.' : undefined))
}

/** Returns body[key] if it is an array; otherwise the response breaks the API contract. */
export function requireArray(body, key, endpoint) {
  if (Array.isArray(body?.[key])) return body[key]
  console.error(`[wedding] ${endpoint}: expected "${key}" to be an array`, body)
  throw new ApiError(200, 'INVALID_RESPONSE', UNREACHABLE)
}

/** JSON request. `form` sends multipart (used by uploads with progress via `upload`). */
export async function api(method, path, { json, form, signal } = {}) {
  const headers = {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : form,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw Object.assign(new Error('network'), { name: 'TypeError' })
  }
  return parse(res.status, await res.text())
}

/** Multipart upload with progress events (fetch cannot report upload progress). */
export function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    xhr.withCredentials = true
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(Object.assign(new Error('network'), { name: 'TypeError' }))
    xhr.onload = () => {
      try {
        resolve(parse(xhr.status, xhr.responseText))
      } catch (error) {
        reject(error)
      }
    }
    xhr.send(form)
  })
}

/**
 * Resolves image URLs. The API returns paths relative to its root
 * ("/media/…"); absolute URLs (https://…) are used unchanged.
 */
export function mediaUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
