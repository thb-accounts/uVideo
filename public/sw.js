const SHELL = 'mplace-shell-v5'
const MEDIA_PREFIX = 'mplace-media-v2-'
const MAX_BYTES = 60 * 1024 * 1024
const downloads = new Map()

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

async function saveVideo(item, signal) {
  const name = MEDIA_PREFIX + encodeURIComponent(item.id)
  const temp = name + '-pending'
  await caches.delete(temp)
  const cache = await caches.open(temp)
  let total = 0
  async function save(url, text = false) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal })
    if (response.status !== 200 || response.type === 'opaque') throw new Error('Video host does not permit offline access')
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
    if (signal?.aborted) throw new Error('Download cancelled')
    let thumbnail = ''
    if (item.thumbnail) {
      try { await save(item.thumbnail); thumbnail = item.thumbnail } catch {
        if (signal?.aborted) throw new Error('Download cancelled')
      }
    }
    const finalCache = await caches.open(name)
    for (const request of await cache.keys()) await finalCache.put(request, await cache.match(request))
    await caches.delete(temp)
    return { url: mediaUrl, bytes: total, thumbnail: thumbnail ? offlineUrl(item.id, thumbnail) : '' }
  } catch (error) { await caches.delete(temp); throw error }
}
self.addEventListener('message', event => {
  const { type, item, id } = event.data || {}
  const reply = data => event.ports?.[0]?.postMessage(data)
  if (type === 'OFFLINE_CACHE' && item?.id && item?.url && event.ports?.[0]) {
    if (downloads.has(item.id)) { reply({ ok: false, error: 'Download already in progress' }); return }
    const controller = new AbortController()
    const task = saveVideo(item, controller.signal)
    downloads.set(item.id, { controller, task })
    event.waitUntil(task.then(result => reply({ ok: true, ...result }))
      .catch(error => reply({ ok: false, error: error.message }))
      .finally(() => downloads.delete(item.id)))
  }
  if (type === 'OFFLINE_REMOVE' && id) event.waitUntil((async () => {
    const active = downloads.get(id)
    active?.controller.abort()
    await active?.task.catch(() => {})
    await caches.delete(MEDIA_PREFIX + encodeURIComponent(id))
    await caches.delete(MEDIA_PREFIX + encodeURIComponent(id) + '-pending')
    reply({ ok: true })
  })())
})
// Same-origin playback avoids returning a cross-origin CORS response to the
// browser's no-CORS video request. Only previously cached bytes are served.
const OFFLINE_PATH = '/__mplace_offline_media__/'
function offlineUrl(id, url) {
  return `${OFFLINE_PATH}${encodeURIComponent(id)}?url=${encodeURIComponent(url)}`
}
async function offlineResponse(request, parsed) {
  const id = decodeURIComponent(parsed.pathname.slice(OFFLINE_PATH.length))
  const original = parsed.searchParams.get('url')
  if (!id || !original) return new Response('Offline video unavailable', { status: 404 })
  const cache = await caches.open(MEDIA_PREFIX + encodeURIComponent(id))
  const cached = await cache.match(original)
  if (!cached) return new Response('Offline video unavailable', { status: 404 })
  const headers = new Headers(cached.headers)
  headers.delete('content-encoding')
  const range = request.headers.get('range')
  if (/\.m3u8(?:\?|$)/i.test(original) && !range) {
    const playlist = await cached.text()
    const rewritten = playlist.split(/\r?\n/).map(line => {
      if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${offlineUrl(id, new URL(uri, original).href)}"`)
      return line.trim() ? offlineUrl(id, new URL(line.trim(), original).href) : line
    }).join('\n')
    headers.delete('content-length')
    headers.set('content-type', 'application/vnd.apple.mpegurl')
    return new Response(rewritten, { status: 200, headers })
  }
  const bytes = await cached.arrayBuffer()
  if (!range) {
    headers.set('content-length', String(bytes.byteLength))
    return new Response(bytes, { status: 200, headers })
  }
  const match = /^bytes=(\d+)-(\d*)$/.exec(range)
  if (!match) return new Response(null, { status: 416 })
  const start = Number(match[1]), end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1
  if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } })
  headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`)
  headers.set('Content-Length', String(end - start + 1)); headers.set('Accept-Ranges', 'bytes')
  return new Response(bytes.slice(start, end + 1), { status: 206, headers })
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin === self.location.origin && url.searchParams.has('mplace-connectivity')) {
    event.respondWith(fetch(event.request))
    return
  }
  if (url.origin === self.location.origin && url.pathname.startsWith(OFFLINE_PATH)) {
    event.respondWith(offlineResponse(event.request, url))
    return
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.open(SHELL)).match('/index.html')))
    return
  }
  event.respondWith((async () => (await (await caches.open(SHELL)).match(event.request)) || fetch(event.request))())
})
