// In-memory brute-force guard for login, keyed by IP + login identifier (staff email / vendor username). Single-process
// only; move to the database or Redis if the API is scaled horizontally.
export function createLoginLimiter({ maxFailures = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const failures = new Map()

  const current = (key) => {
    const entry = failures.get(key)
    if (entry && Date.now() > entry.resetAt) {
      failures.delete(key)
      return null
    }
    return entry
  }

  return {
    isBlocked: (key) => (current(key)?.count ?? 0) >= maxFailures,
    recordFailure(key) {
      if (failures.size > 10_000) failures.clear()
      const entry = current(key)
      if (entry) entry.count++
      else failures.set(key, { count: 1, resetAt: Date.now() + windowMs })
    },
    reset: (key) => failures.delete(key),
  }
}
