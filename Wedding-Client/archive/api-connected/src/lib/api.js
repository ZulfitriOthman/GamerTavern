// Thin client for the existing Wedding API (Wedding/server). The browser never
// talks to the database and holds no secrets: admin auth is an HttpOnly cookie
// set by the API, plus a CSRF token kept in memory for admin writes.
//
//   VITE_API_BASE = API origin only, e.g. https://backend.example.com
//   unset         = same origin (the dev server proxies /api → localhost:4100)
// Every request goes to `${origin}/api/wedding/<endpoint>`.

export const WEDDING_API_PATH = '/api/wedding'

export function resolveApiBase(origin) {
  const clean = String(origin ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(\/wedding)?$/, '')
  return `${clean}${WEDDING_API_PATH}`
}

export const API_BASE = resolveApiBase(import.meta.env?.VITE_API_BASE)

let csrfToken = ''
export const setCsrfToken = (token) => {
  csrfToken = token || ''
}

const UNREACHABLE = 'We could not reach the wedding server. Please check your connection and try again.'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || UNREACHABLE)
    this.status = status
    this.code = code
  }
}

/**
 * Every successful API response is `{ success: true, … }`. Anything else on a
 * 2xx (an HTML fallback page, an empty body) is an error, never data — so the
 * UI can't report success for a request the API never handled.
 */
export function parse(status, text) {
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const isObject = body !== null && typeof body === 'object' && !Array.isArray(body)
  if (status >= 200 && status < 300) {
    if (isObject && body.success === true) return body
    throw new ApiError(status, 'INVALID_RESPONSE', isObject ? body.message : UNREACHABLE)
  }
  if (!isObject) throw new ApiError(status, status === 404 ? 'NOT_FOUND' : 'UNREACHABLE', status === 404 ? 'Not found.' : UNREACHABLE)
  throw new ApiError(status, body.code, body.message)
}

export async function api(method, path, { json, signal } = {}) {
  const headers = {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK', UNREACHABLE)
  }
  return parse(res.status, await res.text())
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    xhr.withCredentials = true
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', UNREACHABLE))
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

/** Media paths from the API ("/media/…") are relative to the API root. */
export function mediaUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

/** A message that is safe and friendly to show to a guest. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return ''
  if (error instanceof ApiError) return error.message || fallback
  return error.message && !/^(network|failed to fetch)/i.test(error.message) ? error.message : fallback
}
