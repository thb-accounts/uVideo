import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AuthPage() {
  const { user, signIn, signInWithGoogle, signUp, hasSupabaseConfig } = useAuth()
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

  async function handleGoogleSignIn() {
    setError('')
    setStatus('Working...')
    try {
      await signInWithGoogle()
      setStatus('Signed in with MPlace ID.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <div className="auth-layout mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <div className="w-full rounded-3xl border border-[var(--app-border)] bg-white p-7 shadow-xl shadow-green-950/5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">MPlace ID</p>
        <h1 className="mb-2 text-2xl font-bold text-[var(--app-text)]">{mode === 'login' ? 'Welcome to MPlace Videos' : 'Create your MPlace ID'}</h1>
        <p className="mb-4 text-sm text-[var(--app-muted)]">One account for MPlace Videos and the wider MPlace family.</p>
        {!hasSupabaseConfig && <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Missing Supabase env vars. Video data syncing is disabled until configured.</p>}
        {location.state?.from && <p className="mb-3 rounded-md bg-[rgba(82,97,58,0.18)] p-2 text-xs text-[var(--brand-cream)]">You can browse without logging in. Sign in is required for: {location.state.from}.</p>}
        <div className="mb-4 flex gap-2">
          {['login', 'signup'].map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); setError(''); setStatus('') }} className={`flex-1 rounded-md px-3 py-2 ${mode === item ? 'bg-[#e7f3ec] text-[#185c3d]' : 'bg-[#f7f8fa]'}`}>
              {item === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
        <button type="button" onClick={handleGoogleSignIn} className="mb-3 w-full rounded-md border border-[var(--app-border)] bg-[#f7f8fa] px-3 py-2 font-semibold text-[var(--app-text)] hover:bg-[#e7f3ec]">Continue with Google</button>
        <div className="mb-3 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-[var(--app-border)]" /><span>or</span><span className="h-px flex-1 bg-[var(--app-border)]" /></div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input aria-label="Email" autoComplete="email" className="w-full rounded-md border border-[var(--app-border)] bg-white p-3 text-[var(--app-text)]" name="email" type="email" placeholder="Email" required />
          <input aria-label="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="w-full rounded-md border border-[var(--app-border)] bg-white p-3 text-[var(--app-text)]" name="password" type="password" placeholder="Password" minLength={6} required />
          {error && <p className="text-sm text-red-700">{error}</p>}
          {status && <p className="text-sm text-emerald-700">{status}</p>}
          <button className="w-full rounded-md brand-button px-3 py-3 font-semibold">{mode === 'login' ? 'Continue with MPlace ID' : 'Create MPlace ID'}</button>
        </form>
        <Link to="/" className="mt-6 block text-center text-sm text-[var(--app-muted)]">← Back to browsing</Link>
      </div>
    </div>
  )
}
