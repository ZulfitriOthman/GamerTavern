import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { PasswordInput } from './PasswordInput.jsx'
import { safeReturnPath } from './returnPath.js'
import { Alert, Brand, Field, Loading } from './ui.jsx'
import { useAuth } from './useAuth.js'

const IDENTIFIERS = {
  email: { label: 'Email', type: 'email', autoComplete: 'username' },
  username: { label: 'Username', type: 'text', autoComplete: 'username' },
}

// `identifier`: what the account signs in with — staff use their email,
// vendors their username. `help` is shown under the form (e.g. how to recover).
// After sign-in (or when already signed in) the user goes to the protected page
// that sent them here, if it is a safe internal path that `isAllowedReturn`
// accepts; otherwise to `home`.
export function LoginPage({ title, subtitle, brandSub, identifier = 'email', help, home = '/', isAllowedReturn }) {
  const { session, loading, login } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const field = IDENTIFIERS[identifier]

  if (loading) {
    return (
      <div className="page-status">
        <Loading />
      </div>
    )
  }
  if (session) {
    return <Navigate to={safeReturnPath(location.state?.from, { isAllowed: isAllowedReturn, fallback: home })} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const id = String(form.get(identifier) ?? '').trim()
    const password = String(form.get('password') ?? '')
    const errors = {}
    if (!id) errors[identifier] = `Enter your ${field.label.toLowerCase()}.`
    if (!password) errors.password = 'Enter your password.'
    setFieldErrors(errors)
    setError('')
    if (Object.keys(errors).length) return
    setSubmitting(true)
    try {
      await login({ [identifier]: id, password })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <Brand sub={brandSub} />
        <form className="card auth-card" onSubmit={handleSubmit} noValidate>
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="lead">{subtitle}</p>}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label={field.label} error={fieldErrors[identifier]}>
            <input
              className="input"
              name={identifier}
              type={field.type}
              autoComplete={field.autoComplete}
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          </Field>
          <PasswordInput label="Password" name="password" autoComplete="current-password" error={fieldErrors.password} />
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {help && <p className="auth-help">{help}</p>}
      </div>
    </main>
  )
}
