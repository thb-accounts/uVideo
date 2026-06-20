import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

function isVerifiedUser(account) {
  return Boolean(account?.email_confirmed_at || account?.confirmed_at || account?.user_metadata?.manual_verified === true)
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!hasSupabaseConfig) return

    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(isVerifiedUser(data.user) ? data.user : null)
        if (data.user && !isVerifiedUser(data.user)) supabase.auth.signOut()
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(isVerifiedUser(nextUser) ? nextUser : null)
      if (nextUser && !isVerifiedUser(nextUser)) supabase.auth.signOut()
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signUp({ email, password, fullName, username }) {
    if (!hasSupabaseConfig) throw new Error('Configure Supabase env vars to enable auth.')
    const emailRedirectTo =
      import.meta.env.VITE_AUTH_REDIRECT_URL ||
      (typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined)

    const normalizedUsername = username?.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username: normalizedUsername }, emailRedirectTo },
    })
    if (error) throw error

    if (data.user?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: fullName,
        username: normalizedUsername,
        email,
      })

      if (profileError) throw profileError
    }

    await supabase.auth.signOut()
  }

  async function signIn({ email, password }) {
    if (!hasSupabaseConfig) throw new Error('Configure Supabase env vars to enable auth.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!isVerifiedUser(data.user)) {
      await supabase.auth.signOut()
      throw new Error('Your account is not verified yet. Email hello@unrealcake8.site to request your verification link, or stay logged out if you do not want to verify.')
    }
  }

  async function signOut() {
    if (!hasSupabaseConfig) return
    await supabase.auth.signOut()
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      hasSupabaseConfig,
      signUp,
      signIn,
      signOut,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
