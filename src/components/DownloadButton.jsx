import { useState } from 'react'
import { cacheMedia, forgetOfflineItem, offlineSupport } from '../lib/offlineStore'
import { useOfflineLibrary } from '../hooks/useOfflineLibrary'
import { useOnline } from '../lib/useOnline'

export default function DownloadButton({ item, compact = false }) {
  const online = useOnline()
  const { items, pending } = useOfflineLibrary()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saved = items.find(entry => entry.id === item?.id)
  const downloading = busy || pending.includes(item?.id)
  const supported = offlineSupport(item)
  async function toggle(event) {
    event.stopPropagation()
    setBusy(true); setError('')
    try {
      if (saved?.persistent || (!online && saved)) await forgetOfflineItem(item.id)
      else await cacheMedia(item, { persistent: true })
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  const label = downloading ? 'Saving…' : saved?.persistent ? 'Downloaded' : !supported && !saved ? 'Streaming only' : 'Download'
  return <div className={compact ? 'max-w-28 text-center' : ''}>
    <button type="button" onClick={toggle} disabled={downloading || (!saved && (!online || !supported))}
      title={!supported && !saved ? 'Embedded videos cannot be downloaded' : saved?.persistent ? 'Remove download from this device' : 'Save to this device for offline watching'}
      aria-label={saved?.persistent ? 'Remove download' : 'Download for offline'}
      className={compact ? 'flex min-h-11 flex-col items-center gap-1 text-xs text-white' : 'min-h-11 rounded-full border border-[var(--app-border)] bg-white px-4 text-sm font-bold hover:bg-[#e8f4ed]'}>
      <span aria-hidden="true" className={compact ? 'text-2xl' : 'mr-2'}>{saved?.persistent ? '✓' : '↓'}</span>{label}
    </button>
    {error && <p role="alert" className={`mt-2 max-w-64 rounded-lg p-2 text-xs ${compact ? 'bg-black/90 text-white' : 'bg-red-50 text-red-700'}`}>{error}</p>}
  </div>
}
