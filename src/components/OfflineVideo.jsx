import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

function originalMediaUrl(src) {
  try { return new URL(src, window.location.origin).searchParams.get('url') || src } catch { return src }
}

export default function OfflineVideo({ src, active = false, className = '', controls = false }) {
  const ref = useRef(null)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const [failure, setFailure] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const video = ref.current
    let alive = true
    let hls
    let objectUrl
    let timer
    const fail = () => { if (alive) setFailure('This saved video could not play. Reconnect and remove it from Downloads, then download it again.') }
    setFailure('')
    async function prepare() {
      const original = originalMediaUrl(src)
      if (/\.m3u8(?:[?#]|$)/i.test(original)) {
        // Stream playlists need a streaming engine on browsers without native HLS.
        // Bundle it with the app so it is available without an internet connection.
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: false, manifestLoadingMaxRetry: 0, fragLoadingMaxRetry: 0 })
          hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail() })
          hls.loadSource(src)
          hls.attachMedia(video)
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src
          video.load()
        } else fail()
      } else {
        // Read complete cached bytes into a blob. The browser handles seeking and
        // range requests itself, including Safari's suffix-range probes.
        const parsed = new URL(src, window.location.origin)
        const id = decodeURIComponent(parsed.pathname.split('/').pop())
        const cache = await caches.open('mplace-media-v2-' + encodeURIComponent(id))
        const response = await cache.match(original)
        if (!response) throw new Error('Saved bytes missing')
        const blob = await response.blob()
        if (!blob.size) throw new Error('Empty saved video')
        if (!alive) return
        const type = /\.mp4(?:[?#]|$)/i.test(original) ? 'video/mp4' : /\.webm(?:[?#]|$)/i.test(original) ? 'video/webm' : blob.type
        objectUrl = URL.createObjectURL(type && type !== blob.type ? new Blob([blob], { type }) : blob)
        video.src = objectUrl
        video.load()
      }
      if (alive && activeRef.current) video.play().catch(() => {})
    }
    const ready = () => { clearTimeout(timer); if (activeRef.current) video.play().catch(() => {}) }
    video.addEventListener('loadedmetadata', ready)
    video.addEventListener('error', fail)
    timer = setTimeout(() => { if (!video.readyState) fail() }, 15000)
    prepare().catch(fail)
    return () => {
      alive = false
      clearTimeout(timer)
      video.removeEventListener('loadedmetadata', ready)
      video.removeEventListener('error', fail)
      hls?.destroy()
      video.pause()
      video.removeAttribute('src')
      video.load()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, attempt]) // Playback state is handled separately without recreating the stream.

  useEffect(() => {
    if (active) ref.current?.play().catch(() => {})
    else if (!controls) ref.current?.pause()
  }, [active, controls])

  return <div className={`relative ${className}`}>
    <video ref={ref} className="h-full w-full object-contain" controls={controls} playsInline loop={!controls} preload="metadata" />
    {failure && <div role="alert" className="absolute inset-0 grid place-items-center bg-[#101a14] p-6 text-center text-sm leading-6 text-white"><div><p>{failure}</p><button onClick={() => setAttempt(value => value + 1)} className="mt-4 rounded-full border border-white/30 px-5 py-2">Retry playback</button></div></div>}
  </div>
}
