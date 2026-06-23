import { createClient } from '@supabase/supabase-js'
import { cleanEnvValue, isPlaceholderValue } from './uploadValidation.js'

export function getSupabaseForRequest(req) {
  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const key = cleanEnvValue(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
  if (!url || !key || isPlaceholderValue(url) || isPlaceholderValue(key)) return null
  const authHeader = req.headers.authorization || ''
  return createClient(url, key, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
