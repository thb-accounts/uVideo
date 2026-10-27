const META_KEY = 'mplace-offline-items-v2'
const LIMIT = 16
const pending = new Set()
function readItems() { try { return JSON.parse(localStorage.getItem(META_KEY) || '[]') } catch { return [] } }
function writeItems(items) { localStorage.setItem(META_KEY, JSON.stringify(items)); window.dispatchEvent(new Event('mplace-offline-changed')) }
export function getOfflineItems() { return readItems() }
export function forgetOfflineItem(id) {
  writeItems(readItems().filter(item => item.id !== id))
  navigator.serviceWorker?.controller?.postMessage({ type: 'OFFLINE_REMOVE', id })
}
export async function cacheMedia(item, { persistent = false } = {}) {
  if (!item?.id || !item?.media_url || !navigator.onLine || pending.has(item.id)) return false
  const existing = readItems().find(entry => entry.id === item.id)
  if (existing) return true
  pending.add(item.id)
  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration?.active) return false
    let url = item.media_url
    if (/\.m3u8(?:\?|$)/i.test(url) && !document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
      if (item.storage_provider !== 'bunny_stream' && !item.bunny_video_id) return false
      const parsed = new URL(url)
      parsed.pathname = parsed.pathname.replace(/playlist\.m3u8$/i, 'play_360p.mp4')
      url = parsed.href
    }
    const result = await new Promise(resolve => {
      const channel = new MessageChannel()
      const timer = setTimeout(() => resolve({ ok: false }), 120000)
      channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data) }
      registration.active.postMessage({ type: 'OFFLINE_CACHE', item: { id: item.id, url } }, [channel.port2])
    })
    if (!result.ok) return false
    const items = readItems().filter(entry => entry.id !== item.id)
    items.unshift({ ...item, media_url: result.url, offline_media: true, persistent, saved_at: new Date().toISOString() })
    const retained = items.slice(0, LIMIT)
    items.slice(LIMIT).forEach(entry => registration.active.postMessage({ type: 'OFFLINE_REMOVE', id: entry.id }))
    writeItems(retained)
    return true
  } catch { return false } finally { pending.delete(item.id) }
}
export function prefetchBlinks(items = []) { items.slice(0, 8).reduce((task, item) => task.then(() => cacheMedia(item)), Promise.resolve()) }
export function prefetchVideos(items = []) { items.slice(0, 4).reduce((task, item) => task.then(() => cacheMedia(item)), Promise.resolve()) }
