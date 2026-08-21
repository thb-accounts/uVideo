import { createClient } from '@supabase/supabase-js'
import { firebaseAuth } from './firebase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(url && key)

export const supabase = hasSupabaseConfig
  ? createClient(url, key, {
      accessToken: async () => firebaseAuth.currentUser ? firebaseAuth.currentUser.getIdToken(false) : null,
    })
  : null
