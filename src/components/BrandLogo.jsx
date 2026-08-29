import { Link } from 'react-router-dom'

const MPLACE_LOGO = 'https://unrealcake8.github.io/cdn-hls/mplace.png'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="MPlace Videos home">
      <img
        src={MPLACE_LOGO}
        alt="MPlace"
        className="h-8 w-auto object-contain transition group-hover:opacity-90"
      />
      {!compact && (
        <span className="hidden text-lg font-extrabold tracking-[-0.04em] text-[var(--app-text)] sm:block">
          Videos
        </span>
      )}
    </Link>
  )
}
