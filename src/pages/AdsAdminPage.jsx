import { useCallback, useEffect, useState } from 'react'
import { firebaseAuth } from '../lib/firebase'
import { apiRequest } from '../lib/apiClient'

export default function AdsAdminPage() {
  const [ads, setAds] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const token = await firebaseAuth.currentUser?.getIdToken()
      const result = await apiRequest('/ads/admin', { token })
      setAds(result.ads)
      setStatus('')
    } catch (error) { setStatus(error.message) }
  }, [])
  useEffect(() => { load() }, [load])
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    try {
      const token = await firebaseAuth.currentUser?.getIdToken()
      await apiRequest('/ads/admin', { method: 'POST', token, body: { title: data.get('title'), media_url: data.get('media_url'), destination_url: data.get('destination_url'), skippable: data.get('skippable') === 'on', skip_after: Number(data.get('skip_after')), enabled: data.get('enabled') === 'on' } })
      form.reset(); await load()
    } catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  async function toggle(ad) {
    try { const token = await firebaseAuth.currentUser?.getIdToken(); await apiRequest(`/ads/admin/${ad.id}`, { method: 'PATCH', token, body: { enabled: !ad.enabled } }); await load() } catch (error) { setStatus(error.message) }
  }
  return <div className="mx-auto max-w-3xl space-y-6 p-6"><div><h1 className="text-2xl font-bold">Video ads</h1><p className="mt-1 text-sm theme-muted">Add a direct HTTPS video file URL. Ads appear before full videos.</p></div>
    {status && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{status}</p>}
    <form onSubmit={submit} className="theme-card grid gap-3 rounded-xl border p-4">
      <label>Ad title<input name="title" required maxLength="120" className="theme-input mt-1 block w-full rounded border p-2" /></label>
      <label>Video file URL<input name="media_url" type="url" required placeholder="https://example.com/ad.mp4" className="theme-input mt-1 block w-full rounded border p-2" /></label>
      <label>Destination URL (optional)<input name="destination_url" type="url" placeholder="https://example.com" className="theme-input mt-1 block w-full rounded border p-2" /></label>
      <label><input name="skippable" type="checkbox" defaultChecked /> Allow skipping</label>
      <label>Skip after (seconds)<input name="skip_after" type="number" min="0" max="120" defaultValue="5" required className="theme-input ml-3 w-20 rounded border p-2" /></label>
      <label><input name="enabled" type="checkbox" /> Enable immediately</label>
      <button disabled={busy} className="rounded-lg bg-[#126341] px-4 py-2 font-bold text-white">{busy ? 'Saving…' : 'Add ad'}</button>
    </form>
    <h2 className="text-lg font-bold">Your ads</h2>{ads.length === 0 && <p className="theme-muted">No ads yet.</p>}
    {ads.map(ad => <div key={ad.id} className="theme-card rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><strong>{ad.title}</strong><p className="text-sm theme-muted">{ad.enabled ? 'Enabled' : 'Paused'} · {ad.skippable ? `Skip after ${ad.skip_after}s` : 'Not skippable'}</p></div><button onClick={() => toggle(ad)} className="rounded-lg border px-3 py-2">{ad.enabled ? 'Pause' : 'Enable'}</button></div><p className="mt-3 text-sm">Plays: {ad.counts.play} · Skips: {ad.counts.skip} · Clicks: {ad.counts.click}</p></div>)}
  </div>
}
