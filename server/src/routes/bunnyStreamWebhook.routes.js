import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { getBunnyVideo } from '../lib/bunnyStream.js'
import { cleanEnvValue } from '../lib/uploadValidation.js'
import { createClient } from '@supabase/supabase-js'

const router = Router()

function isValid(req, rawBody, secret) {
  const version = req.headers['x-bunnystream-signature-version']
  const algorithm = req.headers['x-bunnystream-signature-algorithm']
  const signature = req.headers['x-bunnystream-signature']
  if (version !== 'v1' || algorithm !== 'hmac-sha256' || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
}

function getAdminSupabase() {
  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

router.post('/', async (req, res, next) => {
  try {
    const secret = cleanEnvValue(process.env.BUNNY_STREAM_WEBHOOK_READ_ONLY_KEY)
    if (!secret) return res.status(503).json({ message: 'Bunny Stream webhook signing secret is not configured.' })
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8')
    if (!isValid(req, rawBody, secret)) return res.status(401).json({ message: 'Invalid Bunny Stream webhook signature.' })
    const payload = JSON.parse(rawBody.toString('utf8'))
    const videoId = payload.VideoGuid
    if (!videoId) return res.status(400).json({ message: 'Missing Bunny video GUID.' })
    const supabase = getAdminSupabase()
    if (!supabase) return res.status(503).json({ message: 'Supabase service role is not configured for webhooks.' })
    const video = await getBunnyVideo(videoId)
    await supabase.from('contents').update({
      upload_status: video.uploadStatus,
      encoding_status: video.encodingStatus,
      media_url: video.playbackUrl,
      thumbnail_url: video.thumbnailUrl,
      processing_error: video.failureMessage,
      status: video.uploadStatus === 'ready' ? 'published' : video.uploadStatus === 'failed' ? 'failed' : 'processing',
      ready_at: video.uploadStatus === 'ready' ? new Date().toISOString() : null,
    }).eq('bunny_video_id', videoId)
    return res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
