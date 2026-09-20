import { Router } from 'express'
import { getSupabaseForRequest } from '../lib/supabaseServer.js'

const router = Router()

router.get('/id/:profileId', async (req, res, next) => {
  try {
    const profileId = String(req.params.profileId || '').trim()
    const supabase = getSupabaseForRequest(req)
    if (!supabase) return res.status(503).json({ message: 'Profile service is not configured' })

    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, username, display_name, full_name, avatar_url, bio').eq('id', profileId).maybeSingle()
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
      .select('id, username, display_name, full_name, avatar_url, bio')
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
