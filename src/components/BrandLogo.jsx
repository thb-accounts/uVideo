import { useState } from 'react'
import { useOnline } from '../lib/useOnline'
import { Link } from 'react-router-dom'

const MPLACE_LOGO = 'https://unrealcake8.github.io/cdn-hls/mplace.png'

export default function BrandLogo({ compact = false }) {
  const online = useOnline()
  const [failed, setFailed] = useState(false)
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="MPlace Videos home">
      {online && !failed ? <img
        src={MPLACE_LOGO}
        alt="MPlace"
        onError={() => setFailed(true)}
        className="h-8 w-auto object-contain transition group-hover:opacity-90"
      /> : <span className="text-xl font-extrabold tracking-tight text-[var(--brand-primary)]">MPlace</span>}
      {!compact && (
        <span className="hidden text-lg font-extrabold tracking-[-0.04em] text-[var(--app-text)] sm:block">
          Videos
        </span>
      )}
    </Link>
  )
}
