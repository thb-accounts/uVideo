import { Link } from 'react-router-dom'

const MPLACE_LOGO = 'https://unrealcake8.github.io/cdn-hls/mplace.png'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="MVideo by MPlace home">
      <img
        src={MPLACE_LOGO}
        alt="MPlace"
        className="h-8 w-auto object-contain transition group-hover:opacity-90"
      />
      {!compact && (
        <span className="hidden items-baseline gap-1 sm:flex">
          <span className="text-lg font-black tracking-[-0.04em] text-white">MVideo</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]">by MPlace</span>
        </span>
      )}
    </Link>
  )
}
