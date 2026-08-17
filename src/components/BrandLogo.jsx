import { Link } from 'react-router-dom'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="MVideo home">
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-[#050b15] shadow-[0_0_24px_rgba(0,200,255,0.22)] transition group-hover:scale-105">
        <span className="bg-gradient-to-br from-[#70bdff] to-[#00c8ff] bg-clip-text text-sm font-black tracking-[-0.08em] text-transparent" aria-hidden="true">UC8</span>
      </span>
      {!compact && (
        <span className="hidden text-xl font-black sm:inline tracking-[-0.04em] text-white">
          uc8<span className="text-[#3ea6ff]">Video</span>
        </span>
      )}
    </Link>
  )
}
