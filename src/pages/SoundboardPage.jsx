export default function SoundboardPage() {
  return (
    <div className="h-[calc(100dvh-4rem)] bg-white">
      <div className="flex h-14 items-center justify-between border-b border-[var(--app-border)] px-4 sm:px-6">
        <div>
          <h1 className="text-sm font-medium text-[#202124]">Soundboard</h1>
          <p className="text-xs text-[#5f6368]">Powered by Myinstants</p>
        </div>
        <a href="https://www.myinstants.com" target="_blank" rel="noreferrer" className="text-xs font-medium text-[#1f6f4a] hover:underline">Open separately</a>
      </div>
      <iframe
        src="https://www.myinstants.com"
        title="Myinstants soundboard"
        className="h-[calc(100%-3.5rem)] w-full border-0"
        allow="autoplay"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
