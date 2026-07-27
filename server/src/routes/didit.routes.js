import { Router } from 'express'
import { cleanEnvValue } from '../lib/uploadValidation.js'
import { getSupabaseForRequest } from '../lib/supabaseServer.js'
import { requireUploadAuth } from '../lib/uploadValidation.js'

const router = Router()

router.post('/sessions', requireUploadAuth, async (req, res, next) => {
  try {
    const apiKey = cleanEnvValue(process.env.DIDIT_API_KEY)
    const workflowId = cleanEnvValue(process.env.DIDIT_WORKFLOW_ID)
    if (!apiKey || !workflowId) return res.status(503).json({ message: 'Identity verification is not configured.' })

    const supabase = getSupabaseForRequest(req)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('age_verification_status,didit_session_id')
      .eq('id', req.uploadUser.id)
      .single()
    if (profileError) throw profileError
    if (profile.age_verification_status === 'approved') return res.status(409).json({ message: 'Your age is already verified.' })

    const callbackBase = cleanEnvValue(process.env.APP_URL || process.env.CORS_ORIGIN).replace(/\/$/, '')
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: workflowId,
        callback: `${callbackBase || 'http://localhost:5173'}/verification`,
        vendor_data: req.uploadUser.id,
      }),
    })
    const session = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(session.detail || session.message || 'Didit could not create a verification session.')
      error.status = response.status === 429 ? 429 : 502
      throw error
    }

    const { error } = await supabase.from('profiles').update({
      didit_session_id: session.session_id,
      age_verification_status: 'not_started',
      age_verification_updated_at: new Date().toISOString(),
    }).eq('id', req.uploadUser.id)
    if (error) throw error

    return res.status(201).json({
      sessionId: session.session_id,
      verificationUrl: session.verification_url,
      status: session.status,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/status', requireUploadAuth, async (req, res, next) => {
  try {
    const supabase = getSupabaseForRequest(req)
    const { data, error } = await supabase.from('profiles')
      .select('age_verification_status,age_verified_at,age_verification_updated_at')
      .eq('id', req.uploadUser.id).single()
    if (error) throw error
    return res.json({
      status: data.age_verification_status,
      verifiedAt: data.age_verified_at,
      updatedAt: data.age_verification_updated_at,
    })
  } catch (error) {
    return next(error)
  }
})

export default router
