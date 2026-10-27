const SHELL = 'mplace-shell-v3'
const MEDIA_PREFIX = 'mplace-media-v2-'
const MAX_BYTES = 60 * 1024 * 1024

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL)
    const response = await fetch('/index.html', { cache: 'reload' })
    if (!response.ok) throw new Error('Could not cache application shell')
    const html = await response.clone().text()
    await cache.put('/index.html', response)
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1])
    await Promise.all(assets.map(async url => { const asset = await fetch(url); if (!asset.ok) throw new Error('Could not cache app asset'); await cache.put(url, asset) }))
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('mplace-shell-') && key !== SHELL) await caches.delete(key)
  await self.clients.claim()
})()))

async function saveVideo(item) {
  const name = MEDIA_PREFIX + encodeURIComponent(item.id)
  const temp = name + '-pending'
  await caches.delete(temp)
  const cache = await caches.open(temp)
  let total = 0
  async function save(url, text = false) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok || response.type === 'opaque') throw new Error('Video host does not permit offline access')
    const mime = response.headers.get('content-type') || ''
    if (/text\/html/i.test(mime)) throw new Error('Video URL returned a web page')
    const bytes = await response.clone().arrayBuffer()
    total += bytes.byteLength
    if (total > MAX_BYTES) throw new Error('Video exceeds offline size limit')
    await cache.put(url, response)
    return text ? new TextDecoder().decode(bytes) : ''
  }
  try {
    let mediaUrl = item.url
    if (/\.m3u8(?:\?|$)/i.test(mediaUrl)) {
      let playlist = await save(mediaUrl, true)
      // Store a single rendition to keep device use manageable.
      if (playlist.includes('#EXT-X-STREAM-INF')) {
        const lines = playlist.split(/\r?\n/)
        const index = lines.findIndex(line => line.startsWith('#EXT-X-STREAM-INF'))
        const variant = lines.slice(index + 1).find(line => line.trim() && !line.startsWith('#'))
        if (!variant) throw new Error('No playable rendition')
        mediaUrl = new URL(variant.trim(), mediaUrl).href
        playlist = await save(mediaUrl, true)
      }
      if (!playlist.includes('#EXT-X-ENDLIST')) throw new Error('Live streams cannot be saved offline')
      const resources = []
      for (const line of playlist.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) resources.push(new URL(trimmed, mediaUrl).href)
        if (/^#EXT-X-(KEY|MAP):/.test(trimmed)) {
          if (/METHOD=(SAMPLE-AES|SAMPLE-AES-CTR)/.test(trimmed)) throw new Error('Protected streams cannot be saved offline')
          const uri = trimmed.match(/URI="([^"]+)"/)
          if (uri) resources.push(new URL(uri[1], mediaUrl).href)
        }
      }
      for (const url of new Set(resources)) await save(url)
    } else {
      if (/youtube\.com|youtu\.be/i.test(mediaUrl)) throw new Error('Embedded videos cannot be saved offline')
      await save(mediaUrl)
    }
    const finalCache = await caches.open(name)
    for (const request of await cache.keys()) await finalCache.put(request, await cache.match(request))
    await caches.delete(temp)
    return mediaUrl
  } catch (error) { await caches.delete(temp); throw error }
}
self.addEventListener('message', event => {
  const { type, item, id } = event.data || {}
  if (type === 'OFFLINE_CACHE' && item?.id && item?.url && event.ports[0]) {
    event.waitUntil(saveVideo(item).then(url => event.ports[0].postMessage({ ok: true, url })).catch(error => event.ports[0].postMessage({ ok: false, error: error.message })))
  }
  if (type === 'OFFLINE_REMOVE' && id) event.waitUntil(caches.delete(MEDIA_PREFIX + encodeURIComponent(id)))
})
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.open(SHELL)).match('/index.html')))
    return
  }
  event.respondWith((async () => {
    const url = event.request.url
    const names = (await caches.keys()).filter(key => key.startsWith(MEDIA_PREFIX) && !key.endsWith('-pending'))
    let cached
    for (const name of names) { cached = await (await caches.open(name)).match(url); if (cached) break }
    cached ||= await (await caches.open(SHELL)).match(event.request)
    if (!cached) return fetch(event.request)
    const range = event.request.headers.get('range')
    if (!range) return cached
    const bytes = await cached.arrayBuffer()
    const match = /^bytes=(\d+)-(\d*)$/.exec(range)
    if (!match) return new Response(null, { status: 416 })
    const start = Number(match[1]), end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1
    if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } })
    const headers = new Headers(cached.headers)
    headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`); headers.set('Content-Length', String(end - start + 1)); headers.set('Accept-Ranges', 'bytes')
    return new Response(bytes.slice(start, end + 1), { status: 206, headers })
  })())
})
