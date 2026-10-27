const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync('public/sw.js', 'utf8')
function setup(fetcher) {
  const storage = new Map()
  const caches = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map())
      const entries = storage.get(name)
      const key = r => typeof r === 'string' ? new URL(r, 'https://app.test').href : r.url
      return { put: async (r, v) => entries.set(key(r), v.clone()), match: async r => entries.get(key(r))?.clone(), keys: async () => [...entries.keys()].map(url => new Request(url)) }
    },
    async keys() { return [...storage.keys()] },
    async delete(name) { return storage.delete(name) },
  }
  const handlers = {}
  const self = { location: { origin: 'https://app.test' }, addEventListener(type, fn) { handlers[type] = fn }, clients: { claim() {} }, skipWaiting() {} }
  const context = vm.createContext({ self, caches, fetch: fetcher, Response, Request, Headers, URL, TextDecoder, console })
  vm.runInContext(source, context)
  return { context, handlers, storage }
}
test('downloads a full file and answers video range requests from cache', async () => {
  const env = setup(async () => new Response('abcdefghij', { headers: { 'Content-Type': 'video/mp4' } }))
  const url = 'https://media.test/video.mp4'
  assert.equal(await vm.runInContext(`saveVideo({ id: 'abc', url: '${url}' })`, env.context), url)
  let response
  env.handlers.fetch({ request: new Request(`https://app.test/__mplace_offline_media__/abc?url=${encodeURIComponent(url)}`, { headers: { Range: 'bytes=2-5' } }), respondWith(value) { response = value } })
  response = await response
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 2-5/10')
  assert.equal(await response.text(), 'cdef')
})
test('failed downloads do not become available offline', async () => {
  const env = setup(async () => new Response('missing', { status: 404 }))
  await assert.rejects(vm.runInContext("saveVideo({ id: 'abc', url: 'https://media.test/video.mp4' })", env.context))
  assert.equal(env.storage.has('mplace-media-v2-abc'), false)
  assert.equal(env.storage.has('mplace-media-v2-abc-pending'), false)
})
test('downloads one complete HLS rendition and its segments', async () => {
  const env = setup(async url => new Response(url.endsWith('master.m3u8') ? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvideo.m3u8\n' : url.endsWith('video.m3u8') ? '#EXTM3U\n#EXTINF:1,\nsegment.ts\n#EXT-X-ENDLIST\n' : 'segment'))
  const result = await vm.runInContext("saveVideo({ id: 'abc', url: 'https://media.test/master.m3u8' })", env.context)
  assert.equal(result, 'https://media.test/video.m3u8')
  assert.ok(env.storage.get('mplace-media-v2-abc').has('https://media.test/segment.ts'))
})

test('rewrites HLS playlist and segments to same-origin offline URLs', async () => {
  const env = setup(async url => new Response(url.endsWith('playlist.m3u8') ? '#EXTM3U\n#EXTINF:1,\nsegment.ts\n#EXT-X-ENDLIST\n' : 'segment'))
  await vm.runInContext("saveVideo({ id: 'abc', url: 'https://media.test/playlist.m3u8' })", env.context)
  let response
  const url = 'https://app.test/__mplace_offline_media__/abc?url=' + encodeURIComponent('https://media.test/playlist.m3u8')
  env.handlers.fetch({ request: new Request(url), respondWith(value) { response = value } })
  const playlist = await (await response).text()
  assert.match(playlist, /\/__mplace_offline_media__\/abc\?url=/)
  assert.match(playlist, /segment.ts/)
})
test('offline URLs never fetch the network if the cached file is missing', async () => {
  let calls = 0
  const env = setup(async () => { calls++; throw new Error('unexpected network request') })
  let response
  env.handlers.fetch({ request: new Request('https://app.test/__mplace_offline_media__/missing?url=https%3A%2F%2Fmedia.test%2Fv.mp4'), respondWith(value) { response = value } })
  assert.equal((await response).status, 404)
  assert.equal(calls, 0)
})
