import { Router } from 'express'
import { getAdminSupabase, getSupabaseForRequest } from '../lib/supabaseServer.js'
import { requireUploadAuth } from '../lib/uploadValidation.js'

const router = Router()

router.patch('/me', requireUploadAuth, async (req, res, next) => {
  try {
    const avatarUrl = String(req.body?.avatar_url || '').trim()
    if (!avatarUrl || avatarUrl.length > 2000) return res.status(400).json({ message: 'A valid avatar URL is required' })
    let parsed
    try { parsed = new URL(avatarUrl) } catch { return res.status(400).json({ message: 'A valid avatar URL is required' }) }
    if (parsed.protocol !== 'https:') return res.status(400).json({ message: 'Avatar URL must use HTTPS' })
    const supabase = getAdminSupabase()
    if (!supabase) return res.status(503).json({ message: 'Profile service is not configured' })
    const { data, error } = await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', req.uploadUser.id).select('*').single()
    if (error) throw error
    return res.json({ profile: data })
  } catch (error) { return next(error) }
})

router.get('/id/:profileId', async (req, res, next) => {
  try {
    const profileId = String(req.params.profileId || '').trim()
    const supabase = getSupabaseForRequest(req)
    if (!supabase) return res.status(503).json({ message: 'Profile service is not configured' })

    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle()
    if (profileError) throw profileError
    const { data: videos, error: videosError } = await supabase.from('contents').select('*').eq('user_id', profileId).or('status.eq.published,status.is.null').order('created_at', { ascending: false })
    if (videosError) throw videosError
    return res.json({ profile: profile || { id: profileId, username: 'creator', display_name: 'Creator' }, videos: videos || [] })
  } catch (error) {
    return next(error)
  }
})

router.get('/:username', async (req, res, next) => {
  try {
    const username = decodeURIComponent(req.params.username || '').trim()
    if (!username) return res.status(400).json({ message: 'Username is required' })

    const supabase = getSupabaseForRequest(req)
    if (!supabase) return res.status(503).json({ message: 'Profile service is not configured' })

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle()
    if (profileError) throw profileError

    let query = supabase.from('contents').select('*').or('status.eq.published,status.is.null')
    query = profile?.id ? query.or(`user_id.eq.${profile.id},username.ilike.${username}`) : query.ilike('username', username)
    const { data: videos, error: videosError } = await query.order('created_at', { ascending: false })
    if (videosError) throw videosError

    return res.json({
      profile: profile || { username, display_name: username },
      videos: videos || [],
    })
  } catch (error) {
    return next(error)
  }
})

export default router
