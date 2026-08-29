const SETTINGS_KEY = 'holostem_ui_settings'

const defaults = {
  largeText: false,
  simpleMode: false,
  darkMode: false,
  bionicReading: false,
  mutedByDefault: true,
}

export function readUiSettings() {
  if (typeof window === 'undefined') return defaults
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY)) || {}
    return { ...defaults, ...stored, darkMode: false }
  } catch {
    return defaults
  }
}

export function applyUiSettings(settings) {
  document.documentElement.classList.toggle('text-lg', settings.largeText)
  document.documentElement.classList.toggle('simple-mode', settings.simpleMode)
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.remove('light')
}

export function persistUiSettings(settings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, darkMode: false }))
}
