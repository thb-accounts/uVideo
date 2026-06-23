import { Router } from 'express'
import { createBunnyVideo, createTusUploadCredentials, deleteBunnyVideo, getBunnyVideo, getBunnyStreamConfig } from '../lib/bunnyStream.js'
import { getSupabaseForRequest } from '../lib/supabaseServer.js'
import { rateLimitUploadPermission, requireUploadAuth, validateContentMetadata, validateUploadRequest } from '../lib/uploadValidation.js'

const router = Router()

function requireSupabase(req, res) {
  const supabase = getSupabaseForRequest(req)
  if (!supabase) {
    res.status(503).json({ message: 'Supabase is not configured for server uploads.' })
    return null
  }
  return supabase
}

function statusFields(video) {
  return {
    storage_provider: 'bunny_stream',
    storage_key: video.videoId,
    bunny_video_id: video.videoId,
    bunny_library_id: video.libraryId,
    cloudinary_public_id: null,
    media_url: video.playbackUrl,
    thumbnail_url: video.thumbnailUrl,
    upload_status: video.uploadStatus,
    encoding_status: video.encodingStatus,
    processing_error: video.failureMessage,
    status: video.uploadStatus === 'ready' ? 'published' : video.uploadStatus === 'failed' ? 'failed' : 'processing',
    ready_at: video.uploadStatus === 'ready' ? new Date().toISOString() : null,
  }
}

async function getOwnedContent(supabase, contentId, userId) {
  const { data, error } = await supabase.from('contents').select('*').eq('id', contentId).maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.user_id !== userId) return false
  return data
}

router.post('/uploads', requireUploadAuth, rateLimitUploadPermission, async (req, res, next) => {
  try {
    if (!getBunnyStreamConfig()) return res.status(503).json({ message: 'Bunny Stream not configured' })
    const supabase = requireSupabase(req, res)
    if (!supabase) return

    const upload = validateUploadRequest(req.body)
    if (upload.error) return res.status(400).json({ message: upload.error })
    const metadata = validateContentMetadata(req.body)
    if (metadata.error) return res.status(400).json({ message: metadata.error })

    const bunny = await createBunnyVideo({ title: metadata.title })
    const now = new Date().toISOString()
    const { data: content, error } = await supabase.from('contents').insert({
      user_id: req.uploadUser.id,
      username: metadata.username || null,
      title: metadata.title,
      description: metadata.description,
      type: metadata.type,
      category: metadata.category,
      points: metadata.points,
      recommended: false,
      is_trending: false,
      status: 'processing',
      storage_provider: 'bunny_stream',
      storage_key: bunny.videoId,
      bunny_video_id: bunny.videoId,
      bunny_library_id: bunny.libraryId,
      cloudinary_public_id: null,
      media_url: null,
      thumbnail_url: bunny.thumbnailUrl,
      upload_status: 'uploading',
      encoding_status: bunny.encodingStatus,
      uploaded_at: now,
    }).select().single()
    if (error) {
      await deleteBunnyVideo(bunny.videoId).catch(() => {})
      throw error
    }

    return res.status(201).json({
      contentId: content.id,
      storageProvider: 'bunny_stream',
      upload: createTusUploadCredentials(bunny.videoId),
      metadata: { filetype: upload.contentType, title: metadata.title },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/uploads/:contentId/complete', requireUploadAuth, async (req, res, next) => {
  try {
    const supabase = requireSupabase(req, res)
    if (!supabase) return
    const content = await getOwnedContent(supabase, req.params.contentId, req.uploadUser.id)
    if (content === false) return res.status(403).json({ message: 'Not allowed to update this upload.' })
    if (!content) return res.status(404).json({ message: 'Content not found.' })
    const video = await getBunnyVideo(content.bunny_video_id)
    const updates = statusFields(video)
    const { data, error } = await supabase.from('contents').update(updates).eq('id', content.id).select().single()
    if (error) throw error
    return res.json({ contentId: content.id, ...video, content: data })
  } catch (error) {
    next(error)
  }
})

router.get('/videos/:contentId/status', requireUploadAuth, async (req, res, next) => {
  try {
    const supabase = requireSupabase(req, res)
    if (!supabase) return
    const content = await getOwnedContent(supabase, req.params.contentId, req.uploadUser.id)
    if (content === false) return res.status(403).json({ message: 'Not allowed to inspect this upload.' })
    if (!content) return res.status(404).json({ message: 'Content not found.' })
    const video = await getBunnyVideo(content.bunny_video_id)
    await supabase.from('contents').update(statusFields(video)).eq('id', content.id)
    return res.json({ contentId: content.id, storageProvider: 'bunny_stream', uploadStatus: video.uploadStatus, isPlayable: video.isPlayable, playbackUrl: video.playbackUrl, thumbnailUrl: video.thumbnailUrl, failureMessage: video.failureMessage })
  } catch (error) {
    next(error)
  }
})

router.delete('/videos/:contentId', requireUploadAuth, async (req, res, next) => {
  try {
    const supabase = requireSupabase(req, res)
    if (!supabase) return
    const content = await getOwnedContent(supabase, req.params.contentId, req.uploadUser.id)
    if (content === false) return res.status(403).json({ message: 'Not allowed to delete this upload.' })
    if (!content) return res.status(404).json({ message: 'Content not found.' })
    if (content.bunny_video_id) await deleteBunnyVideo(content.bunny_video_id)
    await supabase.from('contents').update({ status: 'removed', upload_status: 'failed', processing_error: 'Upload cancelled.' }).eq('id', content.id)
    return res.json({ deleted: true, contentId: content.id })
  } catch (error) {
    next(error)
  }
})

export default router
