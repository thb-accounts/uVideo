import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDiditStatus } from '../lib/diditVerification'

const verificationEmail = 'mailto:hello@unrealcake8.site?subject=Start%20account%20verification%20process&body=Hello%2C%20I%20would%20like%20to%20start%20the%20account%20verification%20process.'

const statusCopy = {
  approved: 'Your age is verified. You can upload content.',
  declined: 'We could not confirm that you meet the creator age requirement.',
  in_review: 'Didit is reviewing your verification.',
  in_progress: 'Your verification is still in progress.',
  abandoned: 'The previous verification was not completed. You can try again.',
  expired: 'The previous verification expired. Start a new check.',
}

export default function VerificationPage() {
  const [verification, setVerification] = useState({ status: 'loading' })
  const [message, setMessage] = useState('')

  async function refresh() {
    try {
      setVerification(await getDiditStatus())
    } catch (error) {
      setMessage(error.message)
      setVerification({ status: 'unverified' })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const approved = verification.status === 'approved'
  const retryable = ['unverified', 'not_started', 'declined', 'abandoned', 'expired', 'pending'].includes(verification.status)

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#102132] via-[#121212] to-[#07131b] p-6 shadow-2xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator verification</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">Verify you are 15+</h1>
        <p className="mt-4 max-w-2xl leading-7 text-white/70">
          Before you can upload, Didit securely checks your identity and confirms that you meet our creator age requirement.
        </p>
      </section>

      <section className="theme-card space-y-5 rounded-[1.5rem] border p-6">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-[#3ea6ff]/15 text-2xl">{approved ? '✓' : '🪪'}</span>
          <div>
            <h2 className="text-xl font-black">{approved ? 'Age verified' : 'A quick, secure check'}</h2>
            <p className="mt-1 theme-muted">{statusCopy[verification.status] || 'Have an identity document ready. The secure flow will guide you through each step.'}</p>
          </div>
        </div>

        {!approved && <ul className="grid gap-2 text-sm theme-muted sm:grid-cols-3"><li>• Hosted securely by Didit</li><li>• Camera-guided capture</li><li>• Required only for uploads</li></ul>}

        {approved ? (
          <Link className="inline-flex rounded-full bg-[#3ea6ff] px-6 py-3 font-black text-[#06131c]" to="/upload">Continue to upload</Link>
        ) : retryable ? (
          <a className="inline-flex rounded-full bg-[#3ea6ff] px-6 py-3 font-black text-[#06131c]" href={verificationEmail}>
            Email to start account verification
          </a>
        ) : (
          <button className="rounded-full border border-white/15 px-6 py-3 font-black" onClick={refresh} type="button">Check status</button>
        )}
        {message && <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm theme-muted" role="status">{message}</p>}
        <p className="text-xs theme-muted">We store the verification result, session reference, and threshold—not your identity document.</p>
      </section>
    </main>
  )
}
