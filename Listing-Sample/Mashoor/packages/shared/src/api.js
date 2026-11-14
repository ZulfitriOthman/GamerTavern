export const UNAUTHORIZED_EVENT = 'mashoor:unauthorized'

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message)
    this.status = status
    this.code = data?.code ?? null
    this.data = data
  }
}

// Returns a fetch wrapper bound to one API prefix (/api/mashoor/admin or /api/mashoor/portal).
// Session cookies are httpOnly and sent automatically; the frontend never sees them.
export function createApi(basePath) {
  return async function api(path, { method = 'GET', body } = {}) {
    // FormData (file uploads) is sent as-is; the browser sets the multipart boundary.
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    const res = await fetch(basePath + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    })
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    if (res.status === 204) return null
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status}).`, data)
    return data
  }
}
