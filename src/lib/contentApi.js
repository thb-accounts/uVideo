import { fallbackContent } from '../data/fallbackContent'
import { hasSupabaseConfig, supabase } from './supabase'

// ─── Content ──────────────────────────────────────────────────────────────────

export function isShortContent(item = {}) {
  const type = String(item.type || '').trim().toLowerCase()
  const category = String(item.category || '').trim().toLowerCase()
  return type === 'short' || type === 'slim' || category === 'shorts' || category === 'slims'
}

export async function fetchContent({ category = 'all', feed = 'videos' } = {}) {
  if (!hasSupabaseConfig) {
    const content = feed === 'shorts'
      ? fallbackContent.filter(isShortContent)
      : feed === 'all'
        ? fallbackContent
        : fallbackContent.filter((item) => !isShortContent(item))
    return content
  }

  let query = supabase
    .from('contents')
    .select('*')
    .or('status.eq.published,status.is.null')
    .or('upload_status.eq.ready,upload_status.is.null')
    .order('created_at', { ascending: false })

  if (feed === 'shorts') {
    query = query.or('type.eq.short,type.eq.slim,category.eq.Shorts,category.eq.Slims')
  }

  if (category !== 'all') query = query.eq('type', category)


  const { data, error } = await query
  if (error) throw error
  const content = data ?? []
  if (feed === 'videos') return content.filter((item) => !isShortContent(item))
  return content
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
      .filter((item) => item.username === username || (userId && item.user_id === userId))
      .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))
  }

  let query = supabase.from('contents').select('*')

  if (userId) {
    query = query.eq('user_id', userId)
  } else {
    query = query.eq('username', username)
  }

  if (includeUnpublished) {
    query = query.or('status.is.null,status.neq.removed')
  } else {
    query = query.or('status.eq.published,status.is.null').or('upload_status.eq.ready,upload_status.is.null')
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

export async function addComment() {
  throw new Error('Commenting is disabled.')
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

export async function saveProfile() {
  throw new Error('Profile editing is disabled.')
}

export async function getProfile(userId) {
  if (!hasSupabaseConfig || !userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getProfileByUsername(username) {
  if (!username) return null
  if (!hasSupabaseConfig) {
    const firstVideo = fallbackContent.find((item) => item.username === username)
    return firstVideo
      ? { username, display_name: username, bio: 'Demo creator profile' }
      : null
  }
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  return data
}

export async function getUserIdByUsername(username) {
  if (!username) return null
  if (!hasSupabaseConfig) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function fetchProfilesBySearch() {
  return []
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

export async function fetchFollowStatus() {
  return false
}

export async function followUser() {
  return undefined
}

export async function unfollowUser() {
  return undefined
}

export async function fetchFollowerCount() {
  return 0
}

export async function fetchFollowingCount() {
  return 0
}

export async function fetchFollowingIds() {
  return []
}

export async function fetchFollowersForUser() {
  return []
}

export async function fetchFollowingForUser() {
  return []
}

export async function fetchFollowNotifications() {
  return []
}

// ─── Content Creation ─────────────────────────────────────────────────────────

export async function createContent(payload) {
  if (!hasSupabaseConfig) throw new Error('Supabase is not configured.')
  const insertPayload = {
    ...payload,
    status: payload.status || 'published',
    moderation_method: null,
    moderation_reason: null,
    moderation_requested_at: null,
  }
  const { data, error } = await supabase.from('contents').insert(insertPayload).select().single()
  if (!error) return data

  const metadataColumns = ['storage_provider', 'storage_key', 'cloudinary_public_id', 'bunny_video_id', 'bunny_library_id', 'upload_status', 'encoding_status', 'processing_error', 'uploaded_at', 'ready_at']
  const mayBeMissingMetadataColumn = metadataColumns.some((column) => String(error.message || '').includes(column))
  if (!mayBeMissingMetadataColumn) throw error

  const compatiblePayload = { ...insertPayload }
  metadataColumns.forEach((column) => {
    delete compatiblePayload[column]
  })
  const retry = await supabase.from('contents').insert(compatiblePayload).select().single()
  if (retry.error) throw retry.error
  return retry.data
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
