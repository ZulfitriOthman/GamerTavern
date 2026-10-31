import { LoaderCircle, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Field } from '../../components/ui/Field.jsx'
import { LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { Monogram } from '../../components/ui/Ornaments.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { SetupRequired } from '../components/SetupRequired.jsx'

export function LoginPage() {
  const { status, signIn } = useAuth()
  const { content } = useSite()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (status === 'unavailable') return <SetupRequired />
  if (status === 'loading') return <LoadingBlock label="Checking your access…" />
  if (status === 'admin') return <Navigate to={location.state?.from ?? '/admin'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hero-wash grid min-h-dvh place-items-center px-5 py-12">
      <div className="card w-full max-w-md p-8 sm:p-10">
        <Monogram text={content.couple.monogram} className="mx-auto size-16 text-xl" />
        <h1 className="mt-6 text-center text-4xl">Couple&apos;s Dashboard</h1>
        <p className="mt-2 text-center text-sm text-muted">Sign in to manage your wedding website.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Email">
            {(p) => <input {...p} type="email" required autoComplete="username" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password">
            {(p) => (
              <input {...p} type="password" required autoComplete="current-password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Sign in
          </button>
        </form>
        <p className="mt-8 text-center">
          <Link to="/" className="text-xs tracking-[0.2em] text-muted uppercase hover:text-ink">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  )
}
