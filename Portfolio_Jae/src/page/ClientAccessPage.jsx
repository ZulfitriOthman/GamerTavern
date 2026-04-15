import { useState } from 'react'
import { loginClient, registerClient } from './portfolioStorage'

const ALLOWED_FIELDS_BY_MODE = {
  login: new Set(['email', 'password']),
  signup: new Set(['name', 'email', 'phone', 'password']),
}

function ClientAccessPage({ onNavigate }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [error, setError] = useState('')

  const updateField = (key, value) => {
    if (!ALLOWED_FIELDS_BY_MODE[mode]?.has(key)) {
      return
    }

    setForm((current) => ({ ...current, [key]: value }))
  }

  const setModeWithReset = (nextMode) => {
    setMode(nextMode)
    setError('')

    setForm((current) => ({
      ...current,
      name: nextMode === 'signup' ? current.name : '',
      phone: nextMode === 'signup' ? current.phone : '',
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    try {
      if (mode === 'signup') {
        await registerClient({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        })
      } else {
        await loginClient(form.email.trim(), form.password)
      }

      onNavigate('/client/portal')
    } catch (e) {
      setError(e.message || 'Unable to continue.')
    }
  }

  return (
    <main className="animate-page-fade mx-auto my-6 w-[min(640px,calc(100%-2rem))] rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-[0_20px_36px_rgba(239,68,68,0.15)] md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">Client Portal</p>
      <h1 className="mt-3 font-['Syne'] text-3xl text-[#ffffff]">Share Your Portfolio Materials</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#9ca3af]">
        Create an account or sign in to send your portfolio content, images, and documents.
      </p>

      <div className="relative mt-6 grid grid-cols-2 gap-2 rounded-full border border-[#2a2a2a] bg-[#141414] p-1">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-[#ef4444] shadow-[0_10px_24px_rgba(239,68,68,0.28)] transition-transform duration-300 ease-out ${
            mode === 'signup' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
          }`}
        />
        {['login', 'signup'].map((entry) => (
          <button
            className={`interactive-cta relative z-10 rounded-full px-4 py-2 text-sm font-bold transition-colors duration-300 ${
              mode === entry ? 'text-[#0d0d0d]' : 'text-[#ffffff]'
            }`}
            key={entry}
            onClick={() => setModeWithReset(entry)}
            type="button"
          >
            {entry === 'login' ? 'Login' : 'Sign Up'}
          </button>
        ))}
      </div>

      <form className="mt-6" onSubmit={handleSubmit}>
        <div className="animate-form-swap grid grid-cols-1 gap-4 md:grid-cols-2" key={mode}>
          {mode === 'signup' && (
            <label className="animate-field-reveal block md:col-span-2">
              <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Full Name</span>
              <input
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
                maxLength={80}
                onChange={(event) => updateField('name', event.target.value)}
                pattern="[A-Za-z ]{2,80}"
                required
                type="text"
                value={form.name}
              />
            </label>
          )}

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Email</span>
            <input
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
              autoComplete="email"
              onChange={(event) => updateField('email', event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>

          {mode === 'signup' && (
            <label className="animate-field-reveal block md:col-span-2" style={{ animationDelay: '70ms' }}>
              <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Phone</span>
              <input
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
                maxLength={20}
                onChange={(event) => updateField('phone', event.target.value)}
                pattern="[-0-9+() ]{8,20}"
                type="text"
                value={form.phone}
              />
            </label>
          )}

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Password</span>
            <input
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              onChange={(event) => updateField('password', event.target.value)}
              required
              type="password"
              value={form.password}
            />
          </label>

          {error && <p className="md:col-span-2 text-sm font-bold text-[#f87171]">{error}</p>}

          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              className="interactive-cta rounded-full bg-[#ef4444] px-5 py-2.5 text-sm font-bold text-[#0d0d0d]"
              type="submit"
            >
              {mode === 'signup' ? 'Create Account' : 'Login'}
            </button>
            <button
              className="interactive-cta rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-[#ffffff]"
              onClick={() => onNavigate('/')}
              type="button"
            >
              Back To Portfolio
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}

export default ClientAccessPage
