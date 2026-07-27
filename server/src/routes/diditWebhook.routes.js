import { Router } from 'express'
import { getAdminSupabase } from '../lib/supabaseServer.js'
import { DIDIT_MINIMUM_AGE, normalizeDiditStatus, verifyDiditWebhook } from '../lib/didit.js'

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
    const body = JSON.parse(rawBody.toString('utf8'))
    const valid = verifyDiditWebhook({
      body,
      rawBody,
      signatureV2: req.get('X-Signature-V2'),
      signature: req.get('X-Signature'),
      timestamp: req.get('X-Timestamp'),
    })
    if (!valid) return res.status(401).json({ message: 'Invalid webhook signature.' })

    const userId = body.vendor_data
    if (!userId || !body.session_id) return res.status(400).json({ message: 'Webhook is missing session identifiers.' })
    const supabase = getAdminSupabase()
    if (!supabase) return res.status(503).json({ message: 'Supabase service role is not configured.' })

    const normalizedStatus = normalizeDiditStatus(body.status)
    const approved = normalizedStatus === 'approved'
    const now = new Date().toISOString()
    const { data: current, error: readError } = await supabase.from('profiles')
      .select('id,age_verification_status').eq('id', userId).eq('didit_session_id', body.session_id).maybeSingle()
    if (readError) throw readError
    if (!current) return res.status(404).json({ message: 'Verification session was not found.' })
    if (current.age_verification_status === 'approved' && !approved) return res.status(200).json({ received: true })

    const { data, error } = await supabase.from('profiles').update({
      age_verification_status: normalizedStatus,
      age_verified_at: approved ? now : null,
      age_verification_provider: 'didit',
      age_verification_minimum_age: DIDIT_MINIMUM_AGE,
      age_verification_updated_at: now,
    }).eq('id', userId).eq('didit_session_id', body.session_id).select('id')
    if (error) throw error
    if (!data?.length) return res.status(409).json({ message: 'Verification session changed before it could be updated.' })
    return res.status(200).json({ received: true })
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ message: 'Invalid JSON payload.' })
    return next(error)
  }
})

export default router
