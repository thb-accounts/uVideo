const SHELL_CACHE = 'mplace-shell-v2'
const MEDIA_CACHE = 'mplace-offline-media-v1'
const urlsToCache = ['/', '/offline', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(urlsToCache)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, MEDIA_CACHE].includes(key)).map((key) => caches.delete(key)))),
  ]))
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if ((data.type === 'OFFLINE_PREFETCH' || data.type === 'OFFLINE_SAVE') && data.item?.url) {
    event.waitUntil(caches.open(MEDIA_CACHE).then(async (cache) => {
      try {
        const response = await fetch(data.item.url, { mode: 'cors', credentials: 'omit' })
        if (response.ok || response.type === 'opaque') await cache.put(data.item.url, response)
      } catch {}
    }))
  }
  if (data.type === 'OFFLINE_REMOVE' && data.id) {
    // Metadata is removed by the app. Media cache is intentionally shared and
    // rotates as the browser applies its storage quota.
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (event.request.destination === 'video' || event.request.destination === 'audio') {
    event.respondWith(caches.open(MEDIA_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      try { return await fetch(event.request) } catch { return new Response('', { status: 503 }) }
    }))
    return
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE)
      return (await cache.match('/offline')) || (await cache.match('/index.html'))
    }))
    return
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (url.origin === self.location.origin && response.ok) {
      const clone = response.clone()
      caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone))
    }
    return response
  })))
})
