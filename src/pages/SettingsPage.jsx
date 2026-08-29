import { useEffect, useState } from 'react'
import { applyUiSettings, persistUiSettings, readUiSettings } from '../lib/uiSettings'
import { readUsageSettings, saveUsageSettings } from '../lib/usageLimits'

function ToggleRow({ title, note, checked, onChange }) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-white p-4">
      <div><span className="block text-sm font-bold">{title}</span>{note && <span className="mt-1 block text-xs text-[var(--app-muted)]">{note}</span>}</div>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </label>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(readUiSettings)
  const [usageSettings, setUsageSettings] = useState(readUsageSettings)

  useEffect(() => {
    const lightSettings = { ...settings, darkMode: false }
    persistUiSettings(lightSettings)
    applyUiSettings(lightSettings)
  }, [settings])

  useEffect(() => { saveUsageSettings(usageSettings) }, [usageSettings])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-7"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#20845c]">MPlace Videos</p><h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">Settings</h1><p className="mt-2 text-sm text-[var(--app-muted)]">A simpler light interface, with accessibility and mindful viewing controls.</p></div>

      <section className="theme-card rounded-[22px] border p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Accessibility</h2>
        <div className="mt-4 grid gap-3">
          <ToggleRow title="Large text" checked={settings.largeText} onChange={(e) => setSettings((s) => ({ ...s, largeText: e.target.checked }))} />
          <ToggleRow title="Simple mode" note="Reduces motion and decorative UI." checked={settings.simpleMode} onChange={(e) => setSettings((s) => ({ ...s, simpleMode: e.target.checked }))} />
          <ToggleRow title="Bionic Reading captions" note="Bolds the start of words for easier scanning." checked={settings.bionicReading} onChange={(e) => setSettings((s) => ({ ...s, bionicReading: e.target.checked }))} />
          <ToggleRow title="Muted by default" note="Videos start quietly until you choose otherwise." checked={settings.mutedByDefault} onChange={(e) => setSettings((s) => ({ ...s, mutedByDefault: e.target.checked }))} />
        </div>
      </section>

      <section className="theme-card mt-5 rounded-[22px] border p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Mindful viewing</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="rounded-2xl border border-[var(--app-border)] bg-white p-4"><span className="mb-2 block text-sm font-bold">Daily watch goal</span><select className="theme-input min-h-11 w-full rounded-xl border px-3" value={usageSettings.dailyLimitMinutes} onChange={(e) => setUsageSettings((s) => ({ ...s, onboarded: true, dailyLimitMinutes: Number(e.target.value) }))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label>
          <label className="rounded-2xl border border-[var(--app-border)] bg-white p-4"><span className="mb-2 block text-sm font-bold">Videos per session</span><select className="theme-input min-h-11 w-full rounded-xl border px-3" value={usageSettings.videosPerSession} onChange={(e) => setUsageSettings((s) => ({ ...s, videosPerSession: Number(e.target.value) }))}><option value={5}>5 videos</option><option value={10}>10 videos</option><option value={20}>20 videos</option></select></label>
          <label className="rounded-2xl border border-[var(--app-border)] bg-white p-4 sm:col-span-2"><span className="mb-2 block text-sm font-bold">Extra time when you continue</span><select className="theme-input min-h-11 w-full rounded-xl border px-3" value={usageSettings.extensionMinutes} onChange={(e) => setUsageSettings((s) => ({ ...s, extensionMinutes: Number(e.target.value) }))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option></select></label>
        </div>
      </section>
    </div>
  )
}
