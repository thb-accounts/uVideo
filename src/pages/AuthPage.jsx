import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AuthPage() {
  const { user, signIn, hasSupabaseConfig } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const signupUnavailableMessage = 'Sorry, at the moment, our app is view-only, due to laws that we are legally required to comply with, we can only allow users to send requests for videos to add,'

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')

    setError('')
    setStatus('Working...')

    try {
      await signIn({ email, password })
      setStatus('Logged in successfully.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-glow">
        <h1 className="mb-2 text-2xl font-bold text-neon-cyan">MVideo</h1>
        <p className="mb-4 text-sm text-slate-300">Modern interactive media + learning for all ages.</p>
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
              onClick={() => {
                setMode(item)
                setError('')
                setStatus('')
              }}
              className={`flex-1 rounded-md px-3 py-2 ${mode === item ? 'bg-neon-violet/50' : 'bg-white/5'}`}
            >
              {item === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        {mode === 'signup' ? (
          <div className="rounded-md bg-cyan-500/10 p-3 text-sm text-cyan-100" role="status">
            <p>{signupUnavailableMessage}</p>
            <p className="mt-2">
              Visit{' '}
              <a className="font-semibold underline" href="https://forms.gle/8LEGUUGmpbiGg8Gy5">
                https://forms.gle/8LEGUUGmpbiGg8Gy5
              </a>{' '}
              to send us a video request!
            </p>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
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
        )}
      </div>
    </div>
  )
}
