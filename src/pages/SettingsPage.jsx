import { useEffect, useState } from 'react'
import { applyUiSettings, persistUiSettings, readUiSettings } from '../lib/uiSettings'
import { readUsageSettings, saveUsageSettings } from '../lib/usageLimits'
import VerifyButton from '../components/VerifyButton'

export default function SettingsPage() {
  const [settings, setSettings] = useState(readUiSettings)
  const [usageSettings, setUsageSettings] = useState(readUsageSettings)

  useEffect(() => {
    persistUiSettings(settings)
    applyUiSettings(settings)
  }, [settings])

  useEffect(() => {
    saveUsageSettings(usageSettings)
  }, [usageSettings])

  return (
    <div className="theme-app-bg p-4 space-y-4">
      <h1 className="text-2xl font-bold text-neon-cyan">Accessibility + UI Settings</h1>
      <div className="theme-card space-y-3 rounded-xl border p-4">
        <label className="flex items-center justify-between rounded-lg bg-black/20 p-3">
          <span>Large text mode</span>
          <input type="checkbox" checked={settings.largeText} onChange={(e) => setSettings((s) => ({ ...s, largeText: e.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-black/20 p-3">
          <span>Simple mode (minimal UI)</span>
          <input type="checkbox" checked={settings.simpleMode} onChange={(e) => setSettings((s) => ({ ...s, simpleMode: e.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-black/20 p-3">
          <span>Dark mode</span>
          <input type="checkbox" checked={settings.darkMode} onChange={(e) => setSettings((s) => ({ ...s, darkMode: e.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-black/20 p-3">
          <div>
            <span className="block">Bionic Reading captions</span>
            <span className="text-xs theme-muted">Bolds the start of words for better focus</span>
          </div>
          <input type="checkbox" checked={settings.bionicReading} onChange={(e) => setSettings((s) => ({ ...s, bionicReading: e.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-black/20 p-3">
          <div>
            <span className="block">Muted by default</span>
            <span className="text-xs theme-muted">Prevents sensory overload on page load</span>
          </div>
          <input type="checkbox" checked={settings.mutedByDefault} onChange={(e) => setSettings((s) => ({ ...s, mutedByDefault: e.target.checked }))} />
        </label>
      </div>

      <VerifyButton />

      <div className="theme-card space-y-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Mindful usage</h2>
        <label className="block rounded-lg bg-black/20 p-3">
          <span className="mb-2 block text-sm">Daily watch goal (minutes)</span>
          <select
            className="theme-input w-full rounded-lg border p-2"
            value={usageSettings.dailyLimitMinutes}
            onChange={(e) => setUsageSettings((s) => ({ ...s, onboarded: true, dailyLimitMinutes: Number(e.target.value) }))}
          >
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
          </select>
        </label>
        <label className="block rounded-lg bg-black/20 p-3">
          <span className="mb-2 block text-sm">Videos per intentional session</span>
          <select
            className="theme-input w-full rounded-lg border p-2"
            value={usageSettings.videosPerSession}
            onChange={(e) => setUsageSettings((s) => ({ ...s, videosPerSession: Number(e.target.value) }))}
          >
            <option value={5}>5 videos</option>
            <option value={10}>10 videos</option>
            <option value={20}>20 videos</option>
          </select>
        </label>
        <label className="block rounded-lg bg-black/20 p-3">
          <span className="mb-2 block text-sm">Extra time step when you choose to continue</span>
          <select
            className="theme-input w-full rounded-lg border p-2"
            value={usageSettings.extensionMinutes}
            onChange={(e) => setUsageSettings((s) => ({ ...s, extensionMinutes: Number(e.target.value) }))}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
          </select>
        </label>
      </div>
    </div>
  )
}
