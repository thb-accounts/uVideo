const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
async function setup() {
  let reachable = true
  let calls = 0
  let poll
  const events = {}
  const navigator = { onLine: true }
  const context = vm.createContext({ navigator, AbortController, Date, setTimeout, clearTimeout,
    setInterval(callback) { poll = callback; return 1 }, clearInterval() {},
    window: { addEventListener: (name, handler) => { events[name] = handler }, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    fetch: async () => { calls++; if (!reachable) throw new Error('Wi-Fi without internet'); return { ok: true } },
  })
  const module = new vm.SourceTextModule(fs.readFileSync('src/lib/networkStatus.js', 'utf8'), { context })
  await module.link(() => {}); await module.evaluate()
  return { api: module.namespace, events, navigator, poll: () => poll(), disconnect: () => { reachable = false }, reconnect: () => { reachable = true }, calls: () => calls }
}
test('detects loss of internet even when Wi-Fi remains online, and recovers', async () => {
  const env = await setup()
  const unsubscribe = env.api.subscribeNetwork(() => {})
  await new Promise(resolve => setImmediate(resolve))
  env.disconnect(); await env.poll()
  assert.equal(env.navigator.onLine, true)
  assert.equal(env.api.getNetworkStatus(), false)
  env.reconnect(); await env.poll()
  assert.equal(env.api.getNetworkStatus(), true)
  unsubscribe()
})
test('offline event changes state immediately; online event checks connectivity', async () => {
  const env = await setup()
  const unsubscribe = env.api.subscribeNetwork(() => {})
  await new Promise(resolve => setImmediate(resolve))
  env.events.offline()
  assert.equal(env.api.getNetworkStatus(), false)
  await env.events.online()
  assert.equal(env.api.getNetworkStatus(), true)
  unsubscribe()
})
test('multiple components share a single network check', async () => {
  const env = await setup()
  const one = env.api.subscribeNetwork(() => {})
  const two = env.api.subscribeNetwork(() => {})
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(env.calls(), 1)
  one(); two()
})
