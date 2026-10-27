import { useEffect, useRef } from 'react'
export default function OfflineVideo({ src, active = false, className = '', controls = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (active) ref.current?.play().catch(() => {})
    else ref.current?.pause()
  }, [active, src])
  return <video ref={ref} src={src} className={className} controls={controls} playsInline loop={!controls} preload="metadata" />
}
