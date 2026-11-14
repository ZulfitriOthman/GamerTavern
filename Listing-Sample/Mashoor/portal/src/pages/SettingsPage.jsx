import { useState } from 'react'
import { PasswordInput } from '@mashoor/shared/PasswordInput'
import { useAuth } from '@mashoor/shared/useAuth'
import { Alert, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'

const MIN_LENGTH = 10

// Voluntary password change. The API verifies the current password, signs out
// every other device and renews this browser's session.
export default function SettingsPage() {
  const { session } = useAuth()
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const currentPassword = String(form.get('currentPassword') ?? '')
    const newPassword = String(form.get('newPassword') ?? '')
    const confirmPassword = String(form.get('confirmPassword') ?? '')

    const next = {}
    if (!currentPassword) next.currentPassword = 'Enter your current password.'
    if (newPassword.length < MIN_LENGTH) next.newPassword = `Use at least ${MIN_LENGTH} characters.`
    else if (newPassword === currentPassword) next.newPassword = 'Choose a password different from the current one.'
    if (!confirmPassword) next.confirmPassword = 'Repeat the new password.'
    else if (newPassword !== confirmPassword) next.confirmPassword = 'The new passwords do not match.'
    setErrors(next)
    setMessage(null)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
      formElement.reset()
      setMessage({ tone: 'success', text: 'Password changed. Use your new password next time you sign in. Any other devices were signed out.' })
    } catch (err) {
      if (err.status === 400 && /current password/i.test(err.message)) setErrors({ currentPassword: err.message })
      else if (err.status === 400) setErrors({ newPassword: err.message })
      else setMessage({ tone: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your account details and password." />
      <div className="settings-grid">
        <section className="card" aria-labelledby="account-title">
          <div className="card-head">
            <div>
              <h2 id="account-title">Account</h2>
              <p>Managed by your administrator.</p>
            </div>
          </div>
          <div className="card-body">
            <dl className="dl">
              <div>
                <dt>Name</dt>
                <dd>{session.user.name}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{session.user.username}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{session.company.name}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card" aria-labelledby="password-title">
          <div className="card-head">
            <div>
              <h2 id="password-title">Change password</h2>
              <p>Optional — you can keep using the password you were given. Forgot it? Contact your administrator.</p>
            </div>
          </div>
          <form className="card-body form-stack narrow-form" onSubmit={handleSubmit} noValidate>
            {message && (
              <Alert tone={message.tone} onDismiss={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            <PasswordInput label="Current password" name="currentPassword" autoComplete="current-password" error={errors.currentPassword} />
            <PasswordInput label="New password" name="newPassword" hint={`At least ${MIN_LENGTH} characters.`} error={errors.newPassword} />
            <PasswordInput label="Confirm new password" name="confirmPassword" error={errors.confirmPassword} />
            <div className="form-actions start">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
