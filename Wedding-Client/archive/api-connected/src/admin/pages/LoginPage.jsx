import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '../../components/ui/Field.jsx'
import { Notice } from '../../components/ui/Feedback.jsx'
import { Ornament } from '../../components/ui/Section.jsx'
import { errorMessage } from '../../lib/api.js'
import { useAuth } from '../auth.jsx'

export default function LoginPage() {
  const { login, error: sessionError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Please enter your email and password.')
    setBusy(true)
    setError('')
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed. Please try again.'))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div className="paper relative w-full max-w-sm px-6 py-9 sm:px-8">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-gold/60 text-gold-deep">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-4">For the couple</p>
          <h1 className="mt-2 font-serif text-3xl">Wedding dashboard</h1>
          <Ornament className="mt-4" />
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {(error || sessionError) && <Notice tone="error">{error || sessionError}</Notice>}
          <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">
          Admin accounts are created on the server.{' '}
          <Link to="/" className="underline underline-offset-4 hover:text-ink">
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  )
}
