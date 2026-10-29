import { Link } from 'react-router-dom'
import { forgetOfflineItem, formatBytes } from '../lib/offlineStore'
import { useState } from 'react'

// Deliberately quiet: user-controlled playback, no autoplay or recommendation loop.
export default function OfflineCollection({ items, blinks = false }) {
  const [error, setError] = useState('')
  const sorted = [...items].sort((a, b) => Number(Boolean(b.persistent)) - Number(Boolean(a.persistent)))
  async function remove(id) {
    setError('')
    try { await forgetOfflineItem(id) } catch { setError('Could not remove all video data. Try clearing it in Downloads.') }
  }
  return <section className="offline-collection mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow">MPLACE OFFLINE</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{blinks ? 'Your saved Blinks.' : 'Your saved videos.'}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--app-muted)]">A quieter space. Just what’s on this device, at your pace. Your regular feed returns when you reconnect.</p></div>
      <Link to="?downloads=1" className="rounded-full border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold">Manage downloads</Link>
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!sorted.length ? <div className="mt-8 rounded-3xl border border-dashed border-[var(--app-border)] p-8 text-center"><h2 className="text-lg font-bold">No {blinks ? 'Blinks' : 'videos'} saved yet</h2><p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">When you’re online, use Download on a video you’d like to keep here.</p><Link to={blinks ? '/' : '/blinks'} className="mt-5 inline-block text-sm font-bold text-[var(--brand-primary)]">Check saved {blinks ? 'videos' : 'Blinks'} →</Link></div>
      : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{sorted.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white">
        <Link to={`/video/${item.id}`} className="block"><div className="relative grid aspect-video place-items-center bg-[#e9efeb] text-[var(--brand-primary)]">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy"/> : <span className="text-3xl" aria-hidden="true">▷</span>}<span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold">{item.persistent ? 'Downloaded' : 'Automatically saved'}</span></div><div className="px-4 pt-4"><h2 className="line-clamp-2 font-bold">{item.title}</h2><p className="mt-2 text-xs text-[var(--app-muted)]">{item.username || 'MPlace creator'} · {formatBytes(item.bytes)}</p></div></Link>
        <div className="flex items-center justify-between p-4"><Link to={`/video/${item.id}`} className="text-sm font-semibold text-[var(--brand-primary)]">Watch →</Link><button onClick={() => remove(item.id)} className="min-h-11 text-xs text-[var(--app-muted)]">Remove</button></div>
      </article>)}</div>}
  </section>
}
