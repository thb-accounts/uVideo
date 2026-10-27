import { Router } from 'express'
import { getAdminSupabase } from '../lib/supabaseServer.js'
import { requireUploadAuth } from '../lib/uploadValidation.js'

const router = Router()
function database(res) {
  const db = getAdminSupabase()
  if (!db) res.status(503).json({ message: 'Ad storage is not configured.' })
  return db
}
function requireAdAdmin(req, res, next) {
  const allowed = (process.env.AD_ADMIN_FIREBASE_UIDS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!allowed.includes(req.uploadUser.firebaseUid)) return res.status(403).json({ message: 'Ad administrator access required.' })
  next()
}
const admin = [requireUploadAuth, requireAdAdmin]
function validate(body) {
  const title = String(body.title || '').trim().slice(0, 120)
  const validUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false } }
  const media_url = String(body.media_url || '').trim()
  const destination_url = String(body.destination_url || '').trim()
  const skip_after = Number(body.skip_after)
  if (!title || !validUrl(media_url) || (destination_url && !validUrl(destination_url)) || !Number.isInteger(skip_after) || skip_after < 0 || skip_after > 120) return null
  return { title, media_url, destination_url: destination_url || null, skippable: Boolean(body.skippable), skip_after, enabled: Boolean(body.enabled) }
}
router.get('/active', async (_req, res) => {
  const db = database(res); if (!db) return
  const { data, error } = await db.from('video_ads').select('id,title,media_url,destination_url,skippable,skip_after').eq('enabled', true).limit(50)
  if (error) return res.status(503).json({ message: 'Ads unavailable' })
  res.json({ ad: data.length ? data[Math.floor(Math.random() * data.length)] : null })
})
router.post('/:id/events', async (req, res) => {
  if (!['play', 'skip', 'click'].includes(req.body?.event) || !/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.sendStatus(400)
  const db = database(res); if (!db) return
  const { error } = await db.from('video_ad_events').insert({ ad_id: req.params.id, event: req.body.event })
  res.sendStatus(error ? 400 : 204)
})
router.get('/admin', ...admin, async (_req, res, next) => {
  try {
    const db = database(res); if (!db) return
    const { data, error } = await db.from('video_ads').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const { data: events, error: eventError } = await db.from('video_ad_events').select('ad_id,event').limit(10000)
    if (eventError) throw eventError
    const counts = {}; for (const e of events) { counts[e.ad_id] ||= { play: 0, skip: 0, click: 0 }; counts[e.ad_id][e.event]++ }
    res.json({ ads: data.map(ad => ({ ...ad, counts: counts[ad.id] || { play: 0, skip: 0, click: 0 } })) })
  } catch (error) { next(error) }
})
router.post('/admin', ...admin, async (req, res, next) => {
  try {
    const values = validate(req.body); if (!values) return res.status(400).json({ message: 'Enter a title, HTTPS video URL, optional HTTPS destination and a skip delay between 0 and 120 seconds.' })
    const db = database(res); if (!db) return
    const { data, error } = await db.from('video_ads').insert(values).select().single(); if (error) throw error
    res.status(201).json({ ad: data })
  } catch (error) { next(error) }
})
router.patch('/admin/:id', ...admin, async (req, res, next) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') return res.sendStatus(400)
    const db = database(res); if (!db) return
    const { data, error } = await db.from('video_ads').update({ enabled: req.body.enabled }).eq('id', req.params.id).select().maybeSingle(); if (error) throw error
    if (!data) return res.sendStatus(404)
    res.json({ ad: data })
  } catch (error) { next(error) }
})
export default router
