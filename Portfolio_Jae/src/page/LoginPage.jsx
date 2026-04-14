import { useState } from 'react'
import { login } from './portfolioStorage'

function LoginPage({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    try {
      await login(email.trim(), password)
      onNavigate('/admin')
    } catch (e) {
      setError(e.message || 'Invalid credentials. Please try again.')
    }
  }

  return (
    <main className="mx-auto my-6 w-[min(560px,calc(100%-2rem))] rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-[0_20px_36px_rgba(239,68,68,0.15)] md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">Admin Access</p>
      <h1 className="mt-3 font-['Syne'] text-3xl text-[#ffffff]">Login To Update Portfolio</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#9ca3af]">
        Sign in with an account stored in MySQL to edit About and Contact information.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Email</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Password</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
            type="password"
            value={password}
          />
        </label>

        {error && <p className="text-sm font-bold text-[#f87171]">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            className="rounded-full bg-[#ef4444] px-5 py-2.5 text-sm font-bold text-[#0d0d0d]"
            type="submit"
          >
            Login
          </button>
          <button
            className="rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-[#ffffff]"
            onClick={() => onNavigate('/')}
            type="button"
          >
            Back To Portfolio
          </button>
        </div>
      </form>
      <p className="mt-6 text-xs text-[#9ca3af]">
        Use a registered account from your backend database (table: PERSONAL_USER) and
        include the email in VITE_ADMIN_EMAILS.
      </p>
    </main>
  )
}

export default LoginPage
