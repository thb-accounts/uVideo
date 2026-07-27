import { apiRequest } from './apiClient'
import { supabase } from './supabase'

async function accessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Sign in to verify your age.')
  return data.session.access_token
}

export async function createDiditSession() {
  return apiRequest('/didit/sessions', { method: 'POST', token: await accessToken() })
}

export async function getDiditStatus() {
  return apiRequest('/didit/status', { token: await accessToken() })
}
