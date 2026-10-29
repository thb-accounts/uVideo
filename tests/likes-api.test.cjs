const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

async function loadApi(result, configured = true) {
  const calls = []
  const query = new Proxy({}, { get: (_, method) => method === 'then'
    ? (resolve) => resolve(result)
    : (...args) => { calls.push([method, ...args]); return query } })
  const module = new vm.SourceTextModule(fs.readFileSync('src/lib/contentApi.js', 'utf8'))
  await module.link(async name => {
    const values = name.includes('fallbackContent') ? { fallbackContent: [] }
      : name.includes('supabase') ? { hasSupabaseConfig: configured, supabase: { from: () => query } }
        : { apiRequest: () => {} }
    const dependency = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value)
    })
    return dependency
  })
  await module.evaluate()
  return { api: module.namespace, calls }
}

test('like writes are idempotent and propagate permission failures', async () => {
  const { api, calls } = await loadApi({ error: { message: 'permission denied' } })
  await assert.rejects(api.likeContent('user', 'video'), error => error.message === 'permission denied')
  assert.equal(calls[0][0], 'upsert')
  assert.equal(calls[0][2].ignoreDuplicates, true)
  assert.equal(calls[0][1].user_id, 'user')
})
test('unlike failures are surfaced and writes are scoped to user and content', async () => {
  const { api, calls } = await loadApi({ error: { message: 'offline' } })
  await assert.rejects(api.unlikeContent('user', 'video'), error => error.message === 'offline')
  assert.deepEqual(calls.map(call => Array.from(call)), [['delete'], ['eq', 'user_id', 'user'], ['eq', 'content_id', 'video']])
})
test('status and counts do not turn database failures into false success', async () => {
  const { api } = await loadApi({ error: { message: 'database unavailable' } })
  await assert.rejects(api.fetchLikeStatus('user', 'video'))
  await assert.rejects(api.fetchLikeCount('video'))
})
test('successful reads return persisted status and exact count', async () => {
  const { api } = await loadApi({ data: { user_id: 'user' }, count: 7, error: null })
  assert.equal(await api.fetchLikeStatus('user', 'video'), true)
  assert.equal(await api.fetchLikeCount('video'), 7)
})
test('missing database configuration rejects writes', async () => {
  const { api } = await loadApi({}, false)
  await assert.rejects(api.likeContent('user', 'video'))
  await assert.rejects(api.unlikeContent('user', 'video'))
})
