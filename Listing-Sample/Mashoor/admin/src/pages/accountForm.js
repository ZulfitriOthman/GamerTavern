// Client-side checks before sending; the API validates again.

const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/

// Returns { password, confirmPassword } or { errors: { password?, confirmPassword? } }.
export function readNewPassword(form) {
  const password = String(form.get('password') ?? '')
  const confirmPassword = String(form.get('confirmPassword') ?? '')
  const errors = {}
  if (password.length < 10) errors.password = 'Use at least 10 characters.'
  if (!confirmPassword) errors.confirmPassword = 'Repeat the password.'
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  return Object.keys(errors).length ? { errors } : { password, confirmPassword }
}

export function usernameProblem(value) {
  const username = String(value ?? '').trim()
  if (!username) return 'Enter a username.'
  return USERNAME.test(username) ? '' : 'Use 3–40 letters, digits, dots, dashes or underscores, starting with a letter or digit.'
}

export function required(value, message) {
  return String(value ?? '').trim() ? '' : message
}
