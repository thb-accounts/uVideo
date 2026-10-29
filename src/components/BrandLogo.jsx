import { Link } from 'react-router-dom'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="MPlace Videos home">
      <img src="/mplace.png" alt="MPlace" width="1168" height="258" className="h-8 w-auto object-contain transition group-hover:opacity-90" />
      {!compact && <span className="hidden text-lg font-extrabold tracking-[-0.04em] text-white sm:block">Videos</span>}
    </Link>
  )
}
