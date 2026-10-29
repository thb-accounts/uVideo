// Share one connectivity monitor across every consumer, including download buttons.
// navigator.onLine alone stays true on Wi-Fi networks that have lost internet access.
let online = typeof navigator === 'undefined' || navigator.onLine
const listeners = new Set()
let interval
let activeCheck
let version = 0
function update(value) {
  if (online === value) return
  online = value
  for (const listener of listeners) listener()
}
async function check() {
  if (!navigator.onLine) { offline(); return }
  if (activeCheck || document.visibilityState === 'hidden') return
  const controller = new AbortController()
  activeCheck = controller
  const checkVersion = version
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    // Unique URL and network-only worker handling prevent a cached shell from
    // making a disconnected device look online.
    const response = await fetch(`/index.html?mplace-connectivity=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
    if (checkVersion === version) update(response.ok)
  } catch { if (checkVersion === version) update(false) }
  finally { clearTimeout(timeout); if (activeCheck === controller) activeCheck = null }
}
function offline() {
  version++
  activeCheck?.abort()
  activeCheck = null
  update(false)
}
export function subscribeNetwork(listener) {
  listeners.add(listener)
  if (listeners.size === 1) {
    online = navigator.onLine
    window.addEventListener('online', check)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', check)
    interval = setInterval(check, 15000)
    check()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener('online', check)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', check)
      clearInterval(interval)
      version++
      activeCheck?.abort()
      activeCheck = null
    }
  }
}
export function getNetworkStatus() { return online }
