import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearOfflineItems, forgetOfflineItem, formatBytes, setAutoDownloads } from '../lib/offlineStore'
import { useOfflineLibrary } from '../hooks/useOfflineLibrary'
import { isShortContent } from '../lib/contentApi'

export default function DownloadManager({ onClose }) {
  const { items, pending, automatic } = useOfflineLibrary()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)
  const used = items.reduce((bytes, item) => bytes + (item.bytes || 0), 0)
  useEffect(() => {
    const node = dialog.current
    const previous = document.activeElement
    node.showModal()
    return () => { node.close(); previous?.focus() }
  }, [])
  async function manage(action) {
    setBusy(true); setError('')
    try { await action() } catch { setError('Some video data could not be cleared. Please try again.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose() }} aria-labelledby="downloads-title" className="downloads-dialog w-[min(94vw,560px)] rounded-3xl border border-[var(--app-border)] bg-white p-0 text-[var(--app-text)] shadow-2xl">
    <div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">ON THIS DEVICE</p><h2 id="downloads-title" className="mt-2 text-2xl font-bold">Your downloads</h2></div><button autoFocus onClick={onClose} aria-label="Close downloads" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--app-bg)]">✕</button></div>
      <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">Saved videos appear in Videos and Blinks whenever you’re offline. Downloads stay on this device. Each video can be up to 60 MB.</p>
      <div className="mt-5 rounded-2xl bg-[var(--app-bg)] p-4"><div className="flex justify-between text-sm"><strong>{formatBytes(used)} used</strong><span className="text-[var(--app-muted)]">300 MB limit</span></div><progress value={used} max={300 * 1024 * 1024} aria-label="Offline video storage" className="mt-3 h-2 w-full accent-[#1f6f4a]"/><p className="mt-2 text-xs text-[var(--app-muted)]">{items.filter(item => item.persistent).length} downloads · {items.filter(item => !item.persistent).length} automatic copies{pending.length ? ` · ${pending.length} saving` : ''}</p></div>
      <label className="mt-5 flex cursor-pointer items-start justify-between gap-4"><span><strong className="text-sm">Prepare a few videos automatically</strong><span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">Keeps a small selection ready for connection drops. Your own downloads are kept separately.</span></span><input type="checkbox" checked={automatic} disabled={busy} onChange={event => setAutoDownloads(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#1f6f4a]"/></label>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <ul className="mt-6 max-h-[35dvh] divide-y divide-[var(--app-border)] overflow-y-auto">{items.map(item => <li key={item.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><Link onClick={onClose} to={`/video/${item.id}`} className="line-clamp-2 text-sm font-semibold">{item.title}</Link><p className="mt-1 text-xs text-[var(--app-muted)]">{isShortContent(item) ? 'Blink' : 'Video'} · {formatBytes(item.bytes)} · {item.persistent ? 'Downloaded' : 'Automatic'}</p></div><button disabled={busy} onClick={() => manage(() => forgetOfflineItem(item.id))} aria-label={`Remove ${item.title}`} className="min-h-11 shrink-0 text-xs font-semibold text-[var(--brand-primary)]">Remove</button></li>)}</ul>
      {!items.length && <p className="py-6 text-center text-sm text-[var(--app-muted)]">Use Download while watching a video to save it here.</p>}
      <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-5"><button disabled={busy || (!items.some(item => !item.persistent) && !pending.length)} onClick={() => manage(() => clearOfflineItems({ automaticOnly: true }))} className="min-h-11 rounded-full border border-[var(--app-border)] px-4 text-sm font-semibold">Clear automatic cache</button><button disabled={busy} onClick={() => manage(() => clearOfflineItems())} className="min-h-11 rounded-full bg-red-50 px-4 text-sm font-semibold text-red-700">{busy ? 'Clearing…' : 'Clear all videos'}</button></div>
      <p className="mt-3 text-xs leading-5 text-[var(--app-muted)]">Clearing pauses automatic saving. It removes local copies, including downloads if you clear all; your uploaded videos stay online.</p>
    </div>
  </dialog>
}
