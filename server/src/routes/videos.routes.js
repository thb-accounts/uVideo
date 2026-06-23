import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getSupabaseForRequest } from '../lib/supabaseServer.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const DEFAULT_PUBLIC_LIMIT = 20
const MAX_PUBLIC_LIMIT = 50
const PUBLIC_VIDEO_COLUMNS = 'id,title,description,media_url,thumbnail_url,storage_provider,upload_status,status,created_at,bunny_video_id,cloudinary_public_id'
const PUBLIC_STORAGE_PROVIDERS = ['bunny_stream', 'cloudinary']

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

function isSafePublicVideo(row) {
  return row?.status === 'published'
    && row?.upload_status === 'ready'
    && PUBLIC_STORAGE_PROVIDERS.includes(row?.storage_provider)
    && typeof row?.media_url === 'string'
    && /^https:\/\//i.test(row.media_url)
    && typeof row?.thumbnail_url === 'string'
    && /^https:\/\//i.test(row.thumbnail_url)
}

function toPublicVideo(row) {
  const storageProvider = row.storage_provider === 'cloudinary' ? 'cloudinary' : 'bunny'
  const isMp4 = /\.mp4(?:$|[?#])/i.test(row.media_url)
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    thumbnailUrl: row.thumbnail_url,
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
      .eq('upload_status', 'ready')
      .in('storage_provider', PUBLIC_STORAGE_PROVIDERS)
      .not('media_url', 'is', null)
      .not('thumbnail_url', 'is', null)
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
