const META_KEY = 'mplace-offline-items-v2'
const AUTO_KEY = 'mplace-offline-auto'
const MEDIA_PREFIX = 'mplace-media-v2-'
const AUTO_LIMIT = 8
const MAX_TOTAL_BYTES = 300 * 1024 * 1024
const pending = new Map()
const revisions = new Map()
let generation = 0
let storageQueue = Promise.resolve()
function storageTask(action) {
  const result = storageQueue.then(action)
  storageQueue = result.catch(() => {})
  return result
}

function readItems() {
  try { const items = JSON.parse(localStorage.getItem(META_KEY) || '[]'); return Array.isArray(items) ? items : [] } catch { return [] }
}
function notify() { window.dispatchEvent(new Event('mplace-offline-changed')) }
function writeItems(items) { localStorage.setItem(META_KEY, JSON.stringify(items)); notify() }
export function autoDownloadsEnabled() { return localStorage.getItem(AUTO_KEY) !== 'false' }
export function setAutoDownloads(enabled) { localStorage.setItem(AUTO_KEY, String(enabled)); notify() }
export function getPendingDownloadIds() { return [...pending.keys()] }
export function offlinePlaybackUrl(item) {
  return `/__mplace_offline_media__/${encodeURIComponent(item.id)}?url=${encodeURIComponent(item.media_url)}`
}
export function getOfflineItems() {
  return readItems().map(item => ({ ...item, media_url: offlinePlaybackUrl(item), offline_media: true }))
}
export function formatBytes(bytes = 0) {
  if (!bytes) return '0 MB'
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
export function offlineSupport(item) {
  const url = item?.media_url || ''
  if (!item?.id || !url || /(?:youtube\.com|youtu\.be|iframe\.mediadelivery\.net)/i.test(url)) return false
  return true
}
async function workerMessage(message) {
  if (!navigator.serviceWorker) throw new Error('Downloads need a supported browser and a secure connection.')
  let readyTimer
  let registration
  try {
    registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Offline setup is not ready. Reload and try again.')), 8000) }),
    ])
  } finally { clearTimeout(readyTimer) }
  if (!registration?.active) throw new Error('Offline setup is not ready. Reload and try again.')
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Download timed out. Try again.')) }, 120000)
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close()
      if (event.data?.ok) resolve(event.data)
      else reject(new Error(event.data?.error || 'Could not save this video.'))
    }
    registration.active.postMessage(message, [channel.port2])
  })
}
export async function forgetOfflineItem(id) {
  revisions.set(id, (revisions.get(id) || 0) + 1)
  return storageTask(async () => {
    writeItems(readItems().filter(item => item.id !== id))
    if (pending.has(id)) await workerMessage({ type: 'OFFLINE_REMOVE', id })
    if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(id))
  })
}
export async function clearOfflineItems({ automaticOnly = false } = {}) {
  generation++
  setAutoDownloads(false)
  const removed = readItems().filter(item => !automaticOnly || !item.persistent)
  const ids = new Set([...removed.map(item => item.id), ...[...pending].filter(([, task]) => !automaticOnly || !task.persistent).map(([id]) => id)])
  for (const id of ids) revisions.set(id, (revisions.get(id) || 0) + 1)
  return storageTask(async () => {
    writeItems(readItems().filter(item => automaticOnly && item.persistent))
    await Promise.all([...ids].map(async id => {
      if (pending.has(id)) await workerMessage({ type: 'OFFLINE_REMOVE', id })
      if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(id))
    }))
    if (globalThis.caches) {
      const retained = new Set(readItems().map(item => MEDIA_PREFIX + encodeURIComponent(item.id)))
      for (const [id, task] of pending) if (automaticOnly && task.persistent) {
        retained.add(MEDIA_PREFIX + encodeURIComponent(id))
        retained.add(MEDIA_PREFIX + encodeURIComponent(id) + '-pending')
      }
      for (const key of await caches.keys()) if (key.startsWith(MEDIA_PREFIX) && !retained.has(key)) await caches.delete(key)
    }
    notify()
  })
}
export async function reconcileOfflineItems() {
  if (!globalThis.caches) return
  return storageTask(async () => {
    const names = new Set(await caches.keys())
    const items = readItems()
    const available = items.filter(item => names.has(MEDIA_PREFIX + encodeURIComponent(item.id)))
    let updated = available.length !== items.length
    for (const item of available) if (!Number.isFinite(item.bytes)) {
      const cache = await caches.open(MEDIA_PREFIX + encodeURIComponent(item.id))
      let bytes = 0
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        if (response) bytes += (await response.arrayBuffer()).byteLength
      }
      item.bytes = bytes
      updated = true
    }
    if (updated) writeItems(available)
  })
}
export async function cacheMedia(item, { persistent = false } = {}) {
  if (!navigator.onLine) throw new Error('Connect to the internet to download a video.')
  if (!offlineSupport(item)) throw new Error('This video uses an embedded player and cannot be downloaded.')
  const existing = readItems().find(entry => entry.id === item.id)
  if (existing) {
    if (persistent && !existing.persistent) writeItems(readItems().map(entry => entry.id === item.id ? { ...entry, persistent: true } : entry))
    return true
  }
  if (pending.has(item.id)) {
    const existingTask = pending.get(item.id)
    if (persistent) existingTask.persistent = true
    await existingTask
    if (persistent) {
      const saved = readItems().find(entry => entry.id === item.id)
      if (!saved) throw new Error('Download was cancelled.')
      writeItems(readItems().map(entry => entry.id === item.id ? { ...entry, persistent: true } : entry))
    }
    return true
  }
  const revision = revisions.get(item.id) || 0
  const task = (async () => {
    // Keep the actual stream URL. Bunny MP4 alternatives may not exist.
    const url = item.media_url
    const result = await workerMessage({ type: 'OFFLINE_CACHE', item: { id: item.id, url, thumbnail: item.thumbnail_url } })
    return storageTask(async () => {
      if (revision !== (revisions.get(item.id) || 0)) {
        if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(item.id))
        throw new Error('Download was cancelled.')
      }
      let items = readItems().filter(entry => entry.id !== item.id)
      const bytes = result.bytes || 0
      // Evict only automatic copies. Explicit downloads stay until the user removes them.
      while (items.some(entry => !entry.persistent) &&
        (items.reduce((total, entry) => total + (entry.bytes || 0), bytes) > MAX_TOTAL_BYTES ||
          (!task.persistent && items.filter(entry => !entry.persistent).length >= AUTO_LIMIT))) {
        const oldest = [...items].reverse().find(entry => !entry.persistent)
        items = items.filter(entry => entry.id !== oldest.id)
        if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(oldest.id))
      }
      if (items.reduce((total, entry) => total + (entry.bytes || 0), bytes) > MAX_TOTAL_BYTES) {
        if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(item.id))
        writeItems(items)
        throw new Error('Offline storage is full (300 MB). Remove a download to make room.')
      }
      items.unshift({ ...item, media_url: result.url, thumbnail_url: result.thumbnail || '', offline_media: true,
        persistent: task.persistent, bytes, saved_at: new Date().toISOString() })
      if (revision !== (revisions.get(item.id) || 0)) {
        if (globalThis.caches) await caches.delete(MEDIA_PREFIX + encodeURIComponent(item.id))
        throw new Error('Download was cancelled.')
      }
      writeItems(items)
      return true
    })
  })()
  task.persistent = persistent
  pending.set(item.id, task); notify()
  try { return await task } finally { pending.delete(item.id); notify() }
}
async function prefetch(items) {
  const startedGeneration = generation
  for (const item of items) {
    if (startedGeneration !== generation || !autoDownloadsEnabled() || !navigator.onLine) break
    await cacheMedia(item).catch(() => {})
  }
}
export function prefetchBlinks(items = []) { return prefetch(items.slice(0, 4)) }
export function prefetchVideos(items = []) { return prefetch(items.slice(0, 2)) }
