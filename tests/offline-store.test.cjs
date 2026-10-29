const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const META = 'mplace-offline-items-v2'
const prefix = 'mplace-media-v2-'
async function setup({ initial = [], delayed = false, bytes = 10 } = {}) {
  const values = new Map([[META, JSON.stringify(initial)]])
  const cacheNames = new Set(initial.map(item => prefix + item.id))
  const waiting = []
  const messages = []
  let fail = false
  const navigator = { onLine: true, serviceWorker: { ready: Promise.resolve({ active: { postMessage(message, ports) {
    messages.push(message)
    const respond = data => ports[0].onmessage({ data })
    if (message.type === 'OFFLINE_REMOVE') { cacheNames.delete(prefix + message.id); respond({ ok: true }); return }
    const complete = () => {
      if (fail) { respond({ ok: false, error: 'Host refused download' }); return }
      cacheNames.add(prefix + message.item.id)
      respond({ ok: true, url: message.item.url, bytes })
    }
    if (delayed) waiting.push(complete)
    else queueMicrotask(complete)
  } } }) } }
  class Channel { constructor() { this.port1 = { close() {} }; this.port2 = this.port1 } }
  const context = vm.createContext({ navigator, MessageChannel: Channel, URL, Event, setTimeout, clearTimeout,
    document: { createElement: () => ({ canPlayType: () => '' }) },
    window: { dispatchEvent() {} },
    caches: { keys: async () => [...cacheNames], delete: async name => cacheNames.delete(name), open: async () => ({ keys: async () => [] }) },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  })
  const module = new vm.SourceTextModule(fs.readFileSync('src/lib/offlineStore.js', 'utf8'), { context })
  await module.link(() => {}); await module.evaluate()
  return { api: module.namespace, navigator, cacheNames, messages, values, waiting, fail: () => { fail = true } }
}
const video = id => ({ id, title: id, type: 'video', media_url: `https://media.test/${id}.mp4` })

test('manual download stores bytes and produces a local playback URL', async () => {
  const { api } = await setup()
  await api.cacheMedia(video('one'), { persistent: true })
  const [saved] = api.getOfflineItems()
  assert.equal(saved.persistent, true)
  assert.equal(saved.bytes, 10)
  assert.equal(saved.offline_media, true)
  assert.match(saved.media_url, /^\/__mplace_offline_media__\/one\?url=/)
})
test('automatic copies can be promoted without downloading again', async () => {
  const { api, messages } = await setup()
  await api.cacheMedia(video('one'))
  await api.cacheMedia(video('one'), { persistent: true })
  assert.equal(api.getOfflineItems()[0].persistent, true)
  assert.equal(messages.length, 1)
})
test('concurrent downloads both retain their metadata', async () => {
  const { api } = await setup()
  await Promise.all([api.cacheMedia(video('one')), api.cacheMedia(video('two'))])
  assert.equal(api.getOfflineItems().length, 2)
})
test('automatic retention evicts old automatic copies, never explicit downloads', async () => {
  const { api, cacheNames } = await setup()
  await api.cacheMedia(video('keep'), { persistent: true })
  for (let index = 0; index < 10; index++) await api.cacheMedia(video(`auto-${index}`))
  assert.equal(api.getOfflineItems().length, 9)
  assert.equal(cacheNames.has(prefix + 'keep'), true)
  assert.equal(cacheNames.has(prefix + 'auto-0'), false)
})
test('clear automatic cache retains manual downloads and stops refilling', async () => {
  const { api, cacheNames, messages } = await setup()
  await api.cacheMedia(video('keep'), { persistent: true })
  await api.cacheMedia(video('auto'))
  await api.clearOfflineItems({ automaticOnly: true })
  assert.equal(api.getOfflineItems().length, 1)
  assert.equal(api.getOfflineItems()[0].id, 'keep')
  assert.equal(cacheNames.has(prefix + 'auto'), false)
  assert.equal(api.autoDownloadsEnabled(), false)
  const count = messages.length
  await api.prefetchVideos([video('do-not-refill')])
  assert.equal(messages.length, count)
})
test('clear all removes orphaned media caches without deleting the app shell', async () => {
  const { api, cacheNames } = await setup()
  await api.cacheMedia(video('one'), { persistent: true })
  cacheNames.add(prefix + 'orphan'); cacheNames.add('mplace-shell-v5')
  await api.clearOfflineItems()
  assert.equal(api.getOfflineItems().length, 0)
  assert.deepEqual([...cacheNames], ['mplace-shell-v5'])
})
test('clearing while a download finishes cannot resurrect a removed video', async () => {
  const env = await setup({ delayed: true })
  const work = env.api.cacheMedia(video('one'), { persistent: true })
  // Attach the rejection assertion before allowing cancellation to resolve.
  const rejected = assert.rejects(work, /cancelled/)
  await new Promise(resolve => setImmediate(resolve))
  await env.api.clearOfflineItems()
  env.waiting[0]()
  await rejected
  assert.equal(env.api.getOfflineItems().length, 0)
  assert.equal(env.cacheNames.has(prefix + 'one'), false)
})
test('clear automatic preserves a manual download still in progress', async () => {
  const env = await setup({ delayed: true })
  const work = env.api.cacheMedia(video('keep'), { persistent: true })
  await new Promise(resolve => setImmediate(resolve))
  await env.api.clearOfflineItems({ automaticOnly: true })
  env.waiting[0]()
  await work
  assert.equal(env.api.getOfflineItems()[0].id, 'keep')
})
test('host errors never create downloaded metadata', async () => {
  const env = await setup(); env.fail()
  await assert.rejects(env.api.cacheMedia(video('bad')), /Host refused/)
  assert.equal(env.api.getOfflineItems().length, 0)
})
test('quota rejects a new video instead of evicting manual downloads', async () => {
  const env = await setup({ initial: [{ ...video('keep'), persistent: true, bytes: 300 * 1024 * 1024 }] })
  await assert.rejects(env.api.cacheMedia(video('new'), { persistent: true }), /storage is full/)
  assert.equal(env.api.getOfflineItems()[0].id, 'keep')
  assert.equal(env.cacheNames.has(prefix + 'new'), false)
})
test('evicted browser caches are removed from the offline library', async () => {
  const env = await setup({ initial: [{ ...video('gone'), bytes: 20 }] })
  env.cacheNames.clear()
  await env.api.reconcileOfflineItems()
  assert.equal(env.api.getOfflineItems().length, 0)
})
test('embedded videos are refused and offline requests never start downloads', async () => {
  const env = await setup()
  await assert.rejects(env.api.cacheMedia({ ...video('embed'), media_url: 'https://youtube.com/embed/abc' }), /embedded/)
  env.navigator.onLine = false
  await assert.rejects(env.api.cacheMedia(video('offline')), /Connect/)
  assert.equal(env.messages.length, 0)
})
