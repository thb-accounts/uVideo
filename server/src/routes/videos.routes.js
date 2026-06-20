import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { canPublishPublicly, isModerator } from '../lib/permissions.js'
import { inspectProfanity } from '../lib/profanity.js'
import { buildPendingVideoKey, createPresignedPutUrl, moveVideoForModeration } from '../lib/storage.js'

const router = Router()

const uploadPayloadSchema = z.object({
  caption: z.string().trim().min(1, 'Caption is required').max(280),
  visibility: z.enum(['public', 'friends', 'private']).default('private'),
  videoUrl: z.url('A valid cloud video URL is required').optional(),
  captionUrl: z.string().url('A valid caption URL is required').optional().or(z.literal('')),
  thumbnail: z.url('A valid cloud thumbnail URL is required').optional(),
})

const presignSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  fileName: z.string().trim().min(1),
  contentType: z.string().regex(/^video\//, 'Only video uploads are supported'),
})

function publicVideoWhere() {
  return { visibility: 'public', status: 'approved' }
}

router.get('/feed', async (_req, res) => {
  const videos = await prisma.video.findMany({
    where: publicVideoWhere(),
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          generatedAvatarSeed: true,
          generatedAvatarVariant: true,
        },
      },
      _count: { select: { likes: true } },
    },
  })
  return res.json({ videos })
})

router.post('/uploads/presign', requireAuth, async (req, res, next) => {
  const parsed = presignSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid upload request' })

  const { title, description, fileName, contentType } = parsed.data
  const profanity = inspectProfanity(title)
  if (!profanity.clean) return res.status(400).json({ message: 'Title failed profanity review' })

  try {
    const extension = fileName.split('.').pop() || 'mp4'
    const video = await prisma.video.create({
      data: {
        userId: req.user.id,
        title,
        caption: title,
        description: description || null,
        visibility: 'private',
        status: 'pending',
        storageProvider: 'aws_s3',
      },
    })
    const key = buildPendingVideoKey(req.user.id, video.id, extension)
    const presigned = await createPresignedPutUrl({ key, contentType })
    const updated = await prisma.video.update({ where: { id: video.id }, data: { s3Key: key } })
    return res.status(201).json({ video: updated, upload: presigned })
  } catch (error) {
    return next(error)
  }
})

router.post('/:videoId/uploads/complete', requireAuth, async (req, res) => {
  const { videoId } = req.params
  const video = await prisma.video.findFirst({ where: { id: videoId, userId: req.user.id } })
  if (!video) return res.status(404).json({ message: 'Video not found' })
  return res.json({ video, moderation: 'pending' })
})

router.post('/upload', requireAuth, async (req, res) => {
  const parsed = uploadPayloadSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'Invalid upload payload',
    })
  }

  const { caption, visibility, videoUrl, captionUrl, thumbnail } = parsed.data
  const publicVisibility = visibility === 'public' && canPublishPublicly(req.user) ? 'public' : 'private'

  const video = await prisma.video.create({
    data: {
      userId: req.user.id,
      caption,
      title: caption,
      visibility: publicVisibility,
      status: videoUrl ? 'approved' : 'pending',
      videoUrl,
      cloudfrontUrl: videoUrl || null,
      captionUrl: captionUrl || null,
      thumbnail,
      thumbnailUrl: thumbnail || null,
      approvedAt: videoUrl ? new Date() : null,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          generatedAvatarSeed: true,
          generatedAvatarVariant: true,
        },
      },
      _count: { select: { likes: true } },
    },
  })

  return res.status(201).json({ video })
})

router.get('/moderation/pending', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const videos = await prisma.video.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 })
  return res.json({ videos })
})

router.post('/:videoId/moderation', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const body = z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().optional() }).parse(req.body)
  const data = body.status === 'approved'
    ? { status: 'approved', visibility: 'public', approvedAt: new Date(), cloudfrontUrl: null }
    : { status: 'rejected', visibility: 'private', rejectionReason: body.reason || null }
  const existing = await prisma.video.findUnique({ where: { id: req.params.videoId } })
  if (!existing) return res.status(404).json({ message: 'Video not found' })
  if (existing.s3Key) {
    const moved = await moveVideoForModeration({ currentKey: existing.s3Key, videoId: existing.id, status: body.status })
    data.s3Key = moved.key
    data.cloudfrontUrl = moved.cloudfrontUrl
  }
  const video = await prisma.video.update({ where: { id: existing.id }, data })
  await prisma.auditLog.create({ data: { actorId: req.user.id, action: `video.${body.status}`, targetType: 'video', targetId: video.id, metadata: { reason: body.reason || null } } })
  return res.json({ video })
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

  await prisma.videoLike.create({ data: { videoId, userId: req.user.id } })
  return res.json({ liked: true })
})

export default router
