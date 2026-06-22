import { Link } from 'react-router-dom'

const logoSrc = 'https://unrealcake8.site/cdn-hls/simplychill/logo.png'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="SimpliChill home">
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-[#050b15] shadow-[0_0_24px_rgba(0,200,255,0.22)] transition group-hover:scale-105">
        <img src={logoSrc} alt="" className="h-full w-full object-cover" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="hidden text-xl font-black sm:inline tracking-[-0.04em] text-white">
          Simpli<span className="text-[#3ea6ff]">Chill</span>
        </span>
      )}
    </Link>
  )
}
