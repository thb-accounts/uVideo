import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AuthPage() {
  const { user, signIn, signUp, hasSupabaseConfig } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')
    const fullName = formData.get('fullName')
    const username = formData.get('username')

    setError('')
    setStatus('Working...')

    try {
      if (mode === 'signup') {
        await signUp({ email, password, fullName, username })
        setStatus('Account created. To verify, email hello@unrealcake8.site and request your verification link. You have been logged out until verification is complete.')
      } else {
        await signIn({ email, password })
        setStatus('Logged in successfully.')
      }
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-glow">
        <h1 className="mb-2 text-2xl font-bold text-neon-cyan">UVideo</h1>
        <p className="mb-4 text-sm text-slate-300">Modern interactive media + learning for all ages.</p>
        <p className="mb-4 rounded-md bg-cyan-500/10 p-2 text-xs text-cyan-100">New accounts must be verified before login. Email <a className="font-semibold underline" href="mailto:hello@unrealcake8.site?subject=UVideo%20account%20verification%20request">hello@unrealcake8.site</a> to request your verification link; otherwise you will stay logged out.</p>

        {!hasSupabaseConfig && (
          <p className="mb-3 rounded-md bg-yellow-500/15 p-2 text-xs text-yellow-200">
            Missing Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Auth and data syncing are disabled until configured.
          </p>
        )}
        {location.state?.from && (
          <p className="mb-3 rounded-md bg-[rgba(82,97,58,0.18)] p-2 text-xs text-[var(--brand-cream)]">
            You can browse without logging in. Login is required for: {location.state.from}.
          </p>
        )}

        <div className="mb-4 flex gap-2">
          {['login', 'signup'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`flex-1 rounded-md px-3 py-2 ${mode === item ? 'bg-neon-violet/50' : 'bg-white/5'}`}
            >
              {item === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <input className="w-full rounded-md bg-slate-800 p-2" name="fullName" placeholder="Full name" required />
              <input className="w-full rounded-md bg-slate-800 p-2" name="username" placeholder="Username (no spaces)" pattern="^[a-zA-Z0-9_]{3,20}$" required />
            </>
          )}
          <input className="w-full rounded-md bg-slate-800 p-2" name="email" type="email" placeholder="Email" required />
          <input
            className="w-full rounded-md bg-slate-800 p-2"
            name="password"
            type="password"
            placeholder="Password"
            minLength={6}
            required
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          {status && <p className="text-sm text-emerald-300">{status}</p>}
          <button className="w-full rounded-md bg-neon-cyan px-3 py-2 font-semibold text-slate-950">Continue</button>
        </form>
      </div>
    </div>
  )
}
