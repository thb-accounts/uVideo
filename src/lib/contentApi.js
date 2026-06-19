import { fallbackContent } from '../data/fallbackContent'
import { hasSupabaseConfig, supabase } from './supabase'

// ─── Content ──────────────────────────────────────────────────────────────────

export async function fetchContent({ search = '', category = 'all' } = {}) {
  if (!hasSupabaseConfig) return fallbackContent

  let query = supabase
    .from('contents')
    .select('*')
    .or('status.eq.published,status.is.null')
    .order('created_at', { ascending: false })

  if (category !== 'all') query = query.eq('type', category)
  if (search.trim()) {
    const term = search.trim()
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,username.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchContentById(id) {
  if (!hasSupabaseConfig) return fallbackContent.find((item) => item.id === id)
  const { data, error } = await supabase
    .from('contents')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchVideosByUsername(username, userId = '', { includeUnpublished = false } = {}) {
  if (!hasSupabaseConfig) {
    return fallbackContent
      .filter((item) => item.username?.toLowerCase() === username?.toLowerCase() || (userId && item.user_id === userId))
      .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))
  }

  let query = supabase.from('contents').select('*')

  if (userId) {
    query = query.eq('user_id', userId)
  } else {
    query = query.ilike('username', username)
  }

  if (includeUnpublished) {
    query = query.or('status.is.null,status.neq.removed')
  } else {
    query = query.or('status.eq.published,status.is.null')
  }

  const { data, error } = await query
    .order('is_pinned', { ascending: false, nullsFirst: false })
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function deleteContent(contentId) {
  if (!hasSupabaseConfig) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('contents').delete().eq('id', contentId)
  if (error) throw error
}

export async function updateContentPin({ contentId, userId, isPinned }) {
  if (!hasSupabaseConfig || !contentId || !userId) return null
  const { data, error } = await supabase
    .from('contents')
    .update({
      is_pinned: isPinned,
      pinned_at: isPinned ? new Date().toISOString() : null,
    })
    .eq('id', contentId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export async function fetchLikeStatus(userId, contentId) {
  if (!hasSupabaseConfig || !userId) return false
  const { data } = await supabase
    .from('liked_videos')
    .select('user_id')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .maybeSingle()
  return Boolean(data)
}

export async function likeContent(userId, contentId) {
  if (!hasSupabaseConfig || !userId) return
  await supabase
    .from('liked_videos')
    .upsert({ user_id: userId, content_id: contentId }, { onConflict: 'user_id,content_id' })
}

export async function unlikeContent(userId, contentId) {
  if (!hasSupabaseConfig || !userId) return
  await supabase
    .from('liked_videos')
    .delete()
    .eq('user_id', userId)
    .eq('content_id', contentId)
}

export async function fetchLikeCount(contentId) {
  if (!hasSupabaseConfig) return 0
  const { count, error } = await supabase
    .from('liked_videos')
    .select('*', { count: 'exact', head: true })
    .eq('content_id', contentId)
  if (error) {
    console.error('Error fetching like count:', error)
    return 0
  }
  return count ?? 0
}

export async function fetchLikedVideosForUser(userId) {
  if (!hasSupabaseConfig || !userId) return []
  const { data, error } = await supabase
    .from('liked_videos')
    .select('*, contents(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => row.contents).filter(Boolean)
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(contentId) {
  if (!hasSupabaseConfig) return []
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('content_id', contentId)
    .or('status.eq.published,status.is.null')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    user_handle: row.user_handle || row.username || 'user',
  }))
}

export async function addComment({ userId, contentId, username, body }) {
  if (!hasSupabaseConfig || !userId) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, content_id: contentId, user_handle: username, body, status: 'published', moderation_method: null, moderation_reason: null, moderation_requested_at: null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteComment(commentId) {
  if (!hasSupabaseConfig) return
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
  if (error) throw error
}

// ─── Progress / Views ─────────────────────────────────────────────────────────

export async function markContentViewed(userId, contentId) {
  if (!hasSupabaseConfig || !userId) return
  await supabase.from('user_views').upsert(
    {
      user_id: userId,
      content_id: contentId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,content_id' },
  )
}

export async function completeContent({ userId, content }) {
  if (!hasSupabaseConfig || !userId || !content) return

  const { data: progress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  const newPoints = (progress?.points ?? 0) + (content.points ?? 10)
  const completed = (progress?.completed_count ?? 0) + 1

  await supabase.from('user_progress').upsert({
    user_id: userId,
    points: newPoints,
    completed_count: completed,
    level: Math.max(1, Math.floor(newPoints / 100) + 1),
    updated_at: new Date().toISOString(),
  })
}

export async function getDashboardData(userId) {
  if (!hasSupabaseConfig) {
    return {
      recommended: fallbackContent,
      trending: fallbackContent.filter((item) => item.is_trending),
      recent: fallbackContent.slice(0, 2),
      progress: { points: 0, completed_count: 0, level: 1 },
    }
  }

  const [allRes, recentRes, progressRes] = await Promise.all([
    supabase
      .from('contents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12),
    userId
      ? supabase
          .from('user_views')
          .select('viewed_at, contents(*)')
          .eq('user_id', userId)
          .order('viewed_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
    userId
      ? supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId)
          .single()
      : Promise.resolve({
          data: { points: 0, completed_count: 0, level: 1 },
          error: null,
        }),
  ])

  if (allRes.error) throw allRes.error

  const all = allRes.data ?? []
  const trending = all.filter((item) => item.is_trending)
  const recommended = all.filter((item) => item.recommended).slice(0, 8)
  const recent = (recentRes.data ?? []).map((item) => item.contents).filter(Boolean)

  return {
    recommended: recommended.length ? recommended : all.slice(0, 8),
    trending,
    recent,
    progress: progressRes.data ?? { points: 0, completed_count: 0, level: 1 },
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function saveProfile(userId, values) {
  if (!hasSupabaseConfig || !userId) return
  await supabase.from('profiles').upsert({ id: userId, ...values })
}

export async function getProfile(userId) {
  if (!hasSupabaseConfig || !userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getProfileByUsername(username) {
  const normalizedUsername = username?.trim()
  if (!normalizedUsername) return null

  if (!hasSupabaseConfig) {
    const firstVideo = fallbackContent.find(
      (item) => item.username?.toLowerCase() === normalizedUsername.toLowerCase(),
    )
    return firstVideo
      ? {
          id: firstVideo.user_id || null,
          username: firstVideo.username,
          display_name: firstVideo.username,
          bio: 'Demo creator profile',
        }
      : null
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', normalizedUsername)
    .limit(1)

  if (profileError) throw profileError
  if (profiles?.[0]) return profiles[0]

  // Older content can exist without a matching profile row. Preserve those
  // creator pages and use the content owner to recover profile data when possible.
  const { data: content, error: contentError } = await supabase
    .from('contents')
    .select('user_id, username')
    .ilike('username', normalizedUsername)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contentError) throw contentError
  if (!content) return null

  if (content.user_id) {
    const { data: ownerProfile, error: ownerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', content.user_id)
      .maybeSingle()

    if (ownerError) throw ownerError
    if (ownerProfile) return ownerProfile
  }

  return {
    id: content.user_id || null,
    username: content.username || normalizedUsername,
    display_name: content.username || normalizedUsername,
    bio: '',
  }
}

export async function fetchProfilesBySearch(search = '', { limit = 8 } = {}) {
  const term = search.trim()
  if (!term) return []

  if (!hasSupabaseConfig) {
    const seen = new Set()
    return fallbackContent
      .filter((item) => item.username?.toLowerCase().includes(term.toLowerCase()))
      .filter((item) => {
        if (seen.has(item.username)) return false
        seen.add(item.username)
        return true
      })
      .slice(0, limit)
      .map((item) => ({
        id: item.user_id || item.username,
        username: item.username,
        display_name: item.username,
        avatar_url: '',
        bio: 'Demo creator profile',
      }))
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, full_name, avatar_url, bio')
    .not('username', 'is', null)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%,full_name.ilike.%${term}%`)
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchSuggestedProfiles({ excludeUserId = '', limit = 8 } = {}) {
  if (!hasSupabaseConfig) return []

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, full_name, avatar_url, bio')
    .not('username', 'is', null)
    .limit(limit)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchProfileAvatarsByUserIds(userIds = []) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))]
  if (uniqueIds.length === 0) return {}
  if (!hasSupabaseConfig) return {}

  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', uniqueIds)

  if (error) throw error

  return (data ?? []).reduce((map, row) => {
    map[row.id] = row.avatar_url || ''
    return map
  }, {})
}


// ─── Following / Followers ───────────────────────────────────────────────────

export async function fetchFollowStatus(followerId, followingId) {
  if (!hasSupabaseConfig || !followerId || !followingId) return false
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return Boolean(data)
}

export async function followUser(followerId, followingId) {
  if (!hasSupabaseConfig || !followerId || !followingId || followerId === followingId) return
  const { error } = await supabase
    .from('user_follows')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' })
  if (error) throw error
}

export async function unfollowUser(followerId, followingId) {
  if (!hasSupabaseConfig || !followerId || !followingId) return
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

export async function fetchFollowerCount(userId) {
  if (!hasSupabaseConfig || !userId) return 0
  const { count, error } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId)
  if (error) throw error
  return count ?? 0
}

export async function fetchFollowingCount(userId) {
  if (!hasSupabaseConfig || !userId) return 0
  const { count, error } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId)
  if (error) throw error
  return count ?? 0
}

export async function fetchFollowingIds(userId) {
  if (!hasSupabaseConfig || !userId) return []
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => row.following_id).filter(Boolean)
}

export async function fetchFollowersForUser(userId) {
  if (!hasSupabaseConfig || !userId) return []
  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const profileMap = await fetchProfilesByIds((data ?? []).map((row) => row.follower_id))
  return (data ?? []).map((row) => ({
    ...row,
    profiles: profileMap[row.follower_id] ?? null,
  }))
}

export async function fetchFollowingForUser(userId) {
  if (!hasSupabaseConfig || !userId) return []
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const profileMap = await fetchProfilesByIds((data ?? []).map((row) => row.following_id))
  return (data ?? []).map((row) => ({
    ...row,
    profiles: profileMap[row.following_id] ?? null,
  }))
}

export async function fetchFollowNotifications(userId) {
  if (!hasSupabaseConfig || !userId) return []
  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error

  const profileMap = await fetchProfilesByIds((data ?? []).map((row) => row.follower_id))
  return (data ?? []).map((row) => ({
    ...row,
    profiles: profileMap[row.follower_id] ?? null,
  }))
}

// ─── Content Creation ─────────────────────────────────────────────────────────

export async function createContent(payload) {
  if (!hasSupabaseConfig) throw new Error('Supabase is not configured.')
  const insertPayload = {
    ...payload,
    status: 'published',
    moderation_method: null,
    moderation_reason: null,
    moderation_requested_at: null,
  }
  const { data, error } = await supabase.from('contents').insert(insertPayload).select().single()
  if (error) throw error
  return data
}

export async function createReport(payload) {
  const { data, error } = await supabase.from('reports').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function fetchModeratorQueue(filters = {}) {
  const { status, moderation_method } = filters
  let query = supabase.from('contents').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (moderation_method) query = query.eq('moderation_method', moderation_method)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function updateContentModeration(contentId, updates) {
  const { data, error } = await supabase.from('contents').update(updates).eq('id', contentId).select().single()
  if (error) throw error
  return data
}

export async function fetchReports(filters = {}) {
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.target_type) query = query.eq('target_type', filters.target_type)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function updateReportStatus(reportId, status) {
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId)
  if (error) throw error
}

export async function addUserStrike({ user_id, strike_count = 1, notes = '' }) {
  const { error } = await supabase.rpc('add_user_strike', { p_user_id: user_id, p_increment: strike_count, p_notes: notes })
  if (error) throw error
}

export async function fetchProfilesByIds(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!hasSupabaseConfig || !ids.length) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, email, role')
    .in('id', ids)
  if (error) throw error
  return Object.fromEntries((data || []).map((row) => [row.id, row]))
}

// ─── UVideo API MVP flows ─────────────────────────────────────────────────────

export async function getSupabaseAccessToken() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Please sign in before uploading.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Please sign in before uploading.')

  const token = data?.session?.access_token
  if (!token) throw new Error('Please sign in before uploading.')
  return token
}

export async function requestVideoUpload({ title, description, fileName, contentType }) {
  const { apiRequest } = await import('./apiClient')
  return apiRequest('/videos/uploads/presign', { method: 'POST', token: await getSupabaseAccessToken(), body: { title, description, fileName, contentType } })
}

export async function completeVideoUpload(videoId) {
  const { apiRequest } = await import('./apiClient')
  return apiRequest(`/videos/${videoId}/uploads/complete`, { method: 'POST', token: await getSupabaseAccessToken() })
}

export async function fetchQuickChatPhrases() {
  const { apiRequest } = await import('./apiClient')
  return apiRequest('/quick-chat/phrases')
}

export async function suggestQuickChatPhrase(payload) {
  const { apiRequest } = await import('./apiClient')
  return apiRequest('/quick-chat/suggestions', { method: 'POST', token: await getSupabaseAccessToken(), body: payload })
}
