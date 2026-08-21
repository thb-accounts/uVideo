import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { mplaceUidToUuid } from '../lib/mplaceIdentity'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

async function normalizeUser(account) {
  return {
    id: await mplaceUidToUuid(account.uid),
    uid: account.uid,
    email: account.email,
    email_verified: account.emailVerified,
    user_metadata: {
      username: account.displayName || account.email?.split('@')[0] || 'MPlace user',
      full_name: account.displayName || '',
    },
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function syncProfile(account) {
    const nextUser = await normalizeUser(account)
    if (hasSupabaseConfig) {
      await supabase.from('profiles').upsert({
        id: nextUser.id,
        email: nextUser.email,
        display_name: nextUser.user_metadata.full_name || nextUser.user_metadata.username,
        username: nextUser.user_metadata.username,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }
    setUser(nextUser)
    return nextUser
  }

  useEffect(() => onAuthStateChanged(firebaseAuth, async (account) => {
    try {
      if (account) await syncProfile(account)
      else setUser(null)
    } finally {
      setLoading(false)
    }
  }), [])

  async function signIn({ email, password }) {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
    return syncProfile(credential.user)
  }

  async function signUp({ email, password }) {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
    await sendEmailVerification(credential.user).catch(() => {})
    return syncProfile(credential.user)
  }

  async function signOut() {
    await firebaseSignOut(firebaseAuth)
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    loading,
    hasSupabaseConfig,
    signIn,
    signUp,
    signOut,
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
