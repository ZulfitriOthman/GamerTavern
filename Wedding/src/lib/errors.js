// Turns API / network errors into messages safe to show guests.
// The wedding API only ever returns guest-safe messages (internal errors are
// replaced server-side with a generic one), so those are shown as-is.

export class NotConnectedError extends Error {
  constructor() {
    super('This feature is not available right now — the website could not reach its server. Please try again later.')
    this.name = 'NotConnectedError'
  }
}

export function friendlyError(error, fallback = 'Something went wrong. Please try again in a moment.') {
  if (!error) return fallback
  if (error instanceof NotConnectedError) return error.message
  if (error.name === 'TypeError') return 'We could not reach the server. Please check your connection and try again.'
  if (error.userMessage) return error.userMessage
  if (error.status === 401) return 'Please sign in again.'
  if (error.status === 403) return 'You do not have permission to do that.'
  return fallback
}
