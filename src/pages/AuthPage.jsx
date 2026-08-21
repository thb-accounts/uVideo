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
    setError('')
    setStatus('Working...')
    try {
      if (mode === 'signup') {
        await signUp({ email, password })
        setStatus('MPlace ID created. Check your email to verify it.')
      } else {
        await signIn({ email, password })
        setStatus('Signed in with MPlace ID.')
      }
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-glow">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">MPlace ID</p>
        <h1 className="mb-2 text-2xl font-bold text-neon-cyan">{mode === 'login' ? 'Sign in to MVideo' : 'Create your MPlace ID'}</h1>
        <p className="mb-4 text-sm text-slate-300">One account for MVideo and the wider MPlace family.</p>
        {!hasSupabaseConfig && <p className="mb-3 rounded-md bg-yellow-500/15 p-2 text-xs text-yellow-200">Missing Supabase env vars. Video data syncing is disabled until configured.</p>}
        {location.state?.from && <p className="mb-3 rounded-md bg-[rgba(82,97,58,0.18)] p-2 text-xs text-[var(--brand-cream)]">You can browse without logging in. Sign in is required for: {location.state.from}.</p>}
        <div className="mb-4 flex gap-2">
          {['login', 'signup'].map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); setError(''); setStatus('') }} className={`flex-1 rounded-md px-3 py-2 ${mode === item ? 'bg-neon-violet/50' : 'bg-white/5'}`}>
              {item === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input className="w-full rounded-md bg-slate-800 p-2" name="email" type="email" placeholder="Email" required />
          <input className="w-full rounded-md bg-slate-800 p-2" name="password" type="password" placeholder="Password" minLength={6} required />
          {error && <p className="text-sm text-red-300">{error}</p>}
          {status && <p className="text-sm text-emerald-300">{status}</p>}
          <button className="w-full rounded-md bg-neon-cyan px-3 py-2 font-semibold text-slate-950">{mode === 'login' ? 'Continue with MPlace ID' : 'Create MPlace ID'}</button>
        </form>
      </div>
    </div>
  )
}
