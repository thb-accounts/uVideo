import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getSupabaseForRequest } from '../lib/supabaseServer.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const DEFAULT_PUBLIC_LIMIT = 20
const MAX_PUBLIC_LIMIT = 50
const PUBLIC_VIDEO_COLUMNS = 'id,title,description,media_url,thumbnail_url,storage_provider,upload_status,status,created_at,bunny_video_id,cloudinary_public_id'
const INCOMPLETE_UPLOAD_STATUSES = new Set(['uploading', 'processing', 'failed'])

function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value)
}

const uploadPayloadSchema = z.object({
  caption: z.string().trim().min(1, 'Caption is required').max(280),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  videoUrl: z.url('A valid cloud video URL is required'),
  captionUrl: z.string().url('A valid caption URL is required').optional().or(z.literal('')),
  thumbnail: z.url('A valid cloud thumbnail URL is required').optional(),
})

function parsePublicLimit(rawLimit) {
  if (rawLimit === undefined) return DEFAULT_PUBLIC_LIMIT
  const value = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit
  if (!/^\d+$/.test(String(value))) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null
  return Math.min(parsed, MAX_PUBLIC_LIMIT)
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id }), 'utf8').toString('base64url')
}

function decodeCursor(rawCursor) {
  if (!rawCursor) return { cursor: null }
  const value = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor
  if (typeof value !== 'string' || value.length > 512) return { error: 'Invalid cursor' }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof decoded?.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(decoded.id) || typeof decoded?.createdAt !== 'string' || Number.isNaN(Date.parse(decoded.createdAt))) {
      return { error: 'Invalid cursor' }
    }
    return { cursor: decoded }
  } catch {
    return { error: 'Invalid cursor' }
  }
}

function resolveStorageProvider(row) {
  if (row?.storage_provider === 'bunny_stream' || row?.bunny_video_id) return 'bunny'
  if (row?.storage_provider === 'cloudinary' || row?.cloudinary_public_id || /\/res\.cloudinary\.com\//i.test(row?.media_url || '')) return 'cloudinary'
  return null
}

function bunnyThumbnailFromPlayback(row) {
  if (!row?.bunny_video_id || !isHttpsUrl(row?.media_url)) return null
  try {
    const playbackUrl = new URL(row.media_url)
    return `https://${playbackUrl.host}/${row.bunny_video_id}/thumbnail.jpg`
  } catch {
    return null
  }
}

function cloudinaryThumbnailFromPlayback(row) {
  if (!isHttpsUrl(row?.media_url) || !/\/res\.cloudinary\.com\//i.test(row.media_url)) return null
  return row.media_url
    .replace('/video/upload/', '/video/upload/so_0/')
    .replace(/\.(mp4|mov|m4v|webm)([?#].*)?$/i, '.jpg')
}

function getSafeThumbnailUrl(row, storageProvider) {
  if (isHttpsUrl(row?.thumbnail_url)) return row.thumbnail_url
  const generated = storageProvider === 'bunny' ? bunnyThumbnailFromPlayback(row) : cloudinaryThumbnailFromPlayback(row)
  return isHttpsUrl(generated) ? generated : null
}

function isSafePublicVideo(row) {
  const storageProvider = resolveStorageProvider(row)
  const uploadStatus = row?.upload_status || null
  if (row?.status !== 'published' || !storageProvider || !isHttpsUrl(row?.media_url)) return false
  if (INCOMPLETE_UPLOAD_STATUSES.has(uploadStatus)) return false
  if (storageProvider === 'bunny' && uploadStatus !== 'ready') return false
  return Boolean(getSafeThumbnailUrl(row, storageProvider))
}

function toPublicVideo(row) {
  const storageProvider = resolveStorageProvider(row)
  const isMp4 = /\.mp4(?:$|[?#])/i.test(row.media_url)
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    thumbnailUrl: getSafeThumbnailUrl(row, storageProvider),
    hlsUrl: row.media_url,
    mp4FallbackUrl: storageProvider === 'cloudinary' && isMp4 ? row.media_url : null,
    durationSeconds: 0,
    createdAt: new Date(row.created_at).toISOString(),
    storageProvider,
    isReady: true,
  }
}

router.get('/', async (req, res) => {
  const limit = parsePublicLimit(req.query.limit)
  if (limit === null) return res.status(400).json({ message: 'limit must be a positive integer' })

  const { cursor, error: cursorError } = decodeCursor(req.query.cursor)
  if (cursorError) return res.status(400).json({ message: cursorError })

  try {
    const supabase = getSupabaseForRequest(req)
    if (!supabase) return res.status(500).json({ message: 'Unable to load videos' })

    let query = supabase
      .from('contents')
      .select(PUBLIC_VIDEO_COLUMNS)
      .eq('status', 'published')
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
    }

    const { data, error } = await query
    if (error) throw error

    const safeRows = (data ?? []).filter(isSafePublicVideo)
    const pageRows = safeRows.slice(0, limit)
    const nextCursor = safeRows.length > limit ? encodeCursor(pageRows[pageRows.length - 1]) : null

    res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
    return res.json({ videos: pageRows.map(toPublicVideo), nextCursor })
  } catch (error) {
    console.error('Public videos API failed', error)
    return res.status(500).json({ message: 'Unable to load videos' })
  }
})

router.get('/feed', async (_req, res) => {
  const videos = await prisma.video.findMany({
    where: { visibility: 'public' },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
  })
  return res.json({ videos })
})

router.post('/upload', requireAuth, async (req, res) => {
  const parsed = uploadPayloadSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'Invalid upload payload',
    })
  }

  const { caption, visibility, videoUrl, captionUrl, thumbnail } = parsed.data

  const video = await prisma.video.create({
    data: {
      userId: req.user.id,
      caption,
      visibility,
      videoUrl,
      captionUrl: captionUrl || null,
      thumbnail,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
  })

  return res.status(201).json({ video })
})

router.post('/:videoId/like', requireAuth, async (req, res) => {
  const { videoId } = req.params
  const existing = await prisma.videoLike.findUnique({
    where: { videoId_userId: { videoId, userId: req.user.id } },
  })

  if (existing) {
    await prisma.videoLike.delete({ where: { id: existing.id } })
    return res.json({ liked: false })
  }

  await prisma.videoLike.create({
    data: {
      videoId,
      userId: req.user.id,
    },
  })

  return res.json({ liked: true })
})

router.post('/:videoId/comments', requireAuth, async (req, res) => {
  const { videoId } = req.params
  const { content } = req.body
  if (!content) {
    return res.status(400).json({ message: 'Comment content required' })
  }

  const comment = await prisma.comment.create({
    data: {
      videoId,
      userId: req.user.id,
      content,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    },
  })
  return res.status(201).json({ comment })
})

router.get('/:videoId/comments', async (req, res) => {
  const { videoId } = req.params
  const comments = await prisma.comment.findMany({
    where: { videoId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, username: true, fullName: true } },
    },
    take: 50,
  })
  return res.json({ comments })
})

export default router
