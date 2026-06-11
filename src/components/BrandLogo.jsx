import { Link } from 'react-router-dom'

export default function BrandLogo({ compact = false }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="UVideo home">
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#00c8ff] to-[#3e7bff] shadow-[0_0_24px_rgba(0,200,255,0.22)] transition group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M8 5.2v8.1c0 2.2 1.2 3.5 3.4 3.5s3.5-1.3 3.5-3.5V5.2h3v8.2c0 4-2.5 6.4-6.5 6.4S5 17.4 5 13.4V5.2h3Z" />
          <path d="m14.8 9.1 5.2 3-5.2 3V9.1Z" opacity=".8" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden text-xl font-black sm:inline tracking-[-0.04em] text-white">
          U<span className="text-[#3ea6ff]">Video</span>
        </span>
      )}
    </Link>
  )
}
