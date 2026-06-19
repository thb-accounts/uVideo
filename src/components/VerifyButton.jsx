import { useState } from 'react'
import { DiditSdk } from '@didit-protocol/sdk-web'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/apiClient'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

export default function VerifyButton() {
  const { user } = useAuth()
  const [acceptedDisclosure, setAcceptedDisclosure] = useState(false)
  const [status, setStatus] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  async function getAccessToken() {
    if (!hasSupabaseConfig) return null
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session?.access_token || null
  }

  async function startVerification() {
    if (!acceptedDisclosure) {
      setStatus('Please review and accept the verification disclosure before continuing.')
      return
    }

    setIsStarting(true)
    setStatus('Creating your secure verification session…')

    try {
      const token = await getAccessToken()
      const session = await apiRequest('/api/verification/didit/start', { method: 'POST', token })

      DiditSdk.shared.onComplete = (result) => {
        setStatus(
          result.status === 'completed'
            ? 'Verification flow completed. We will update your account after Didit sends the signed webhook decision.'
            : `Verification flow ${result.status}. You can try again when you are ready.`,
        )
      }
      DiditSdk.shared.startVerification({ url: session.url })
    } catch (error) {
      setStatus(error.message || 'Unable to start verification.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <section className="theme-card space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">Identity verification</h2>
        <p className="mt-1 text-sm theme-muted">
          UVideo uses Didit to verify identity in a hosted, secure flow. Your browser receives only a
          one-time verification URL; the final account decision comes from Didit&apos;s signed server webhook.
        </p>
      </div>

      <label className="flex gap-3 rounded-lg bg-black/20 p-3 text-sm">
        <input
          type="checkbox"
          checked={acceptedDisclosure}
          onChange={(event) => setAcceptedDisclosure(event.target.checked)}
          className="mt-1"
        />
        <span>
          I consent to opening Didit&apos;s hosted verification flow and sharing the information required
          for KYC review. I understand UVideo relies on the verified webhook decision, not this browser callback.
        </span>
      </label>

      <button
        className="rounded-full brand-button px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!user || isStarting || !acceptedDisclosure}
        onClick={startVerification}
      >
        {isStarting ? 'Starting verification…' : 'Verify my identity'}
      </button>
      {!user ? <p className="text-sm text-amber-300">Sign in before starting verification.</p> : null}
      {status ? <p className="text-sm theme-muted" role="status">{status}</p> : null}
    </section>
  )
}
