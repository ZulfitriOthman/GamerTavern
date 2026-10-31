/** Reads/writes sessionStorage safely (private mode or blocked storage just returns null). */
export function sessionFlag(key, value) {
  try {
    if (value === undefined) return window.sessionStorage.getItem(key)
    window.sessionStorage.setItem(key, value)
  } catch {
    return null
  }
  return value
}
