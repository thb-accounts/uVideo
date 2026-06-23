import { createClient } from '@supabase/supabase-js'
import { cleanEnvValue, isPlaceholderValue } from './uploadValidation.js'

function getSupabaseUrl() {
  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  return url && !isPlaceholderValue(url) ? url : ''
}

function getAnonKey() {
  const key = cleanEnvValue(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
  return key && !isPlaceholderValue(key) ? key : ''
}

function getServiceRoleKey() {
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  return key && !isPlaceholderValue(key) ? key : ''
}

export function getSupabaseForRequest(req) {
  const url = getSupabaseUrl()
  const key = getServiceRoleKey() || getAnonKey()
  if (!url || !key) return null

  const usesServiceRole = key === getServiceRoleKey()
  const authHeader = req.headers.authorization || ''
  return createClient(url, key, {
    global: { headers: !usesServiceRole && authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getSupabaseAuthClient() {
  const url = getSupabaseUrl()
  const key = getAnonKey()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
