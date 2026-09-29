const META_KEY = 'mplace-offline-items-v1'

function readItems() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '[]') } catch { return [] }
}

function writeItems(items) {
  localStorage.setItem(META_KEY, JSON.stringify(items.slice(0, 80)))
  window.dispatchEvent(new Event('mplace-offline-changed'))
}

export function getOfflineItems() { return readItems() }

export function rememberOfflineItem(item, { persistent = false } = {}) {
  if (!item?.id || !item?.media_url) return
  const next = readItems().filter((entry) => entry.id !== item.id)
  next.unshift({
    id: item.id,
    title: item.title || 'Untitled',
    username: item.username || '',
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url || '',
    type: item.type || 'short',
    persistent,
    saved_at: new Date().toISOString(),
  })
  writeItems(next)
}

export function forgetOfflineItem(id) {
  writeItems(readItems().filter((item) => item.id !== id))
}

export function cacheMedia(item, { persistent = false } = {}) {
  if (!item?.media_url || !navigator.serviceWorker?.controller) return false
  rememberOfflineItem(item, { persistent })
  navigator.serviceWorker.controller.postMessage({
    type: persistent ? 'OFFLINE_SAVE' : 'OFFLINE_PREFETCH',
    item: { id: item.id, url: item.media_url },
  })
  return true
}

export function prefetchBlinks(items = []) {
  items.filter((item) => /^https?:\/\//i.test(item?.media_url || '')).slice(0, 12).forEach((item) => cacheMedia(item))
}
