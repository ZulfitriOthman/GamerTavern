// Errors whose message is safe to show to guests. Anything else is logged
// server-side and reported to the client as a generic INTERNAL_ERROR.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (message, code = 'VALIDATION_ERROR') => new AppError(400, code, message)
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message)
export const forbidden = (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message)
export const unauthorized = (message = 'Please sign in.') => new AppError(401, 'UNAUTHORIZED', message)
export const conflict = (message, code = 'CONFLICT') => new AppError(409, code, message)
export const tooMany = (message) => new AppError(429, 'RATE_LIMITED', message)

// MySQL problems that mean "the database is unavailable / not set up" rather
// than a bug: answered with 503 so the site shows a friendly notice.
const DB_UNAVAILABLE = new Set([
  'DB_NOT_CONFIGURED', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
])

/** Express 5 forwards rejected promises here automatically. */
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, code: err.code, message: err.message })
  }
  if (err?.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'This photo is too large.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Please upload one photo at a time.'
          : 'Invalid upload.'
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, code: err.code, message })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, code: 'INVALID_JSON', message: 'Invalid request.' })
  }
  if (DB_UNAVAILABLE.has(err?.code) || err?.code === 'ER_NO_SUCH_TABLE') {
    const missingTables = err.code === 'ER_NO_SUCH_TABLE'
    console.error(`[wedding-api] ${req.method} ${req.originalUrl}: database ${missingTables ? 'tables missing — run Wedding/database scripts' : `unavailable (${err.code})`}`)
    return res.status(503).json({
      success: false,
      code: missingTables ? 'DATABASE_NOT_SET_UP' : 'DATABASE_UNAVAILABLE',
      message: 'The website is temporarily unavailable. Please try again in a few minutes.',
    })
  }
  console.error(`[wedding-api] ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again in a moment.' })
}
