export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#20845c]">MPlace Videos</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--app-muted)]">Manage MPlace Videos preferences.</p>
      </div>
      <section className="theme-card rounded-[22px] border p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Playback</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">Videos use their normal audio state. Playback controls are available directly on videos and Blinks.</p>
      </section>
    </div>
  )
}
