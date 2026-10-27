import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../lib/apiClient'

export default function PrerollPlayer({ children }) {
  const [ad, setAd] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [elapsed, setElapsed] = useState(0)
  const counted = useRef(false)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => { if (!cancelled) setPhase('content') }, 2500)
    apiRequest('/ads/active').then(result => {
      if (cancelled) return
      clearTimeout(timer)
      if (result.ad) { setAd(result.ad); setPhase(p => p === 'loading' ? 'ready' : p) }
      else setPhase('content')
    }).catch(() => { if (!cancelled) { clearTimeout(timer); setPhase('content') } })
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (phase !== 'ad' || playing) return
    const timer = setTimeout(() => setPhase('content'), 12000)
    return () => clearTimeout(timer)
  }, [phase, playing])
  function track(event) { if (ad) apiRequest(`/ads/${ad.id}/events`, { method: 'POST', body: { event } }).catch(() => {}) }
  if (phase === 'content') return children
  if (phase === 'loading') return <div className="grid h-full place-items-center text-white">Loading video…</div>
  if (phase === 'ready') return <button className="grid h-full w-full place-items-center text-lg font-bold text-white" onClick={() => setPhase('ad')}>▶ Play video</button>
  return <div className="relative h-full w-full bg-black"><video src={ad.media_url} className="h-full w-full object-contain" autoPlay playsInline onPlaying={() => { setPlaying(true); if (!counted.current) { counted.current = true; track('play') } }} onTimeUpdate={e => setElapsed(e.currentTarget.currentTime)} onEnded={() => setPhase('content')} onError={() => setPhase('content')} />
    <button className="absolute inset-0 h-full w-full" aria-label="Play ad" onClick={e => e.currentTarget.previousElementSibling?.play().catch(() => setPhase('content'))} />
    <span className="absolute left-3 top-3 rounded bg-black/75 px-2 py-1 text-sm text-white">Ad · {ad.title}</span>
    <div className="absolute bottom-14 right-3 flex gap-2">{ad.destination_url && <a href={ad.destination_url} target="_blank" rel="noopener noreferrer" onClick={() => track('click')} className="rounded bg-white px-3 py-2 text-sm font-bold text-black">Visit advertiser</a>}{ad.skippable && <button disabled={elapsed < ad.skip_after} onClick={() => { track('skip'); setPhase('content') }} className="rounded bg-black/80 px-3 py-2 text-sm font-bold text-white disabled:opacity-70">{elapsed < ad.skip_after ? `Skip in ${Math.ceil(ad.skip_after - elapsed)}s` : 'Skip ad'}</button>}</div>
  </div>
}
