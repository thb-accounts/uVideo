import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { isModerator } from '../lib/permissions.js'
import { inspectProfanity } from '../lib/profanity.js'
import { createPresignedPutUrl } from '../lib/storage.js'

const router = Router()
const audioPolicy = 'Allowed: acapella vocals, spoken word, educational narration, human voice recordings, nature sounds, and voice sound effects. Not allowed: instrumental music, explicit lyrics, swearing, or sexual content.'

router.get('/policy', (_req, res) => res.json({ policy: audioPolicy }))

router.post('/submissions/presign', requireAuth, async (req, res, next) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(120), fileName: z.string().trim().min(1), contentType: z.string().regex(/^audio\//) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid audio submission' })
  if (!inspectProfanity(parsed.data.title).clean) return res.status(400).json({ message: 'Audio title failed profanity review' })
  try {
    const submission = await prisma.audioSubmission.create({ data: { title: parsed.data.title, s3Key: `audio/pending/${req.user.id}/${Date.now()}-${parsed.data.fileName.replace(/[^a-z0-9._-]/gi, '_')}`, submittedBy: req.user.id } })
    const upload = await createPresignedPutUrl({ key: submission.s3Key, contentType: parsed.data.contentType })
    return res.status(201).json({ submission, upload, policy: audioPolicy })
  } catch (error) { return next(error) }
})

router.get('/moderation/pending', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const submissions = await prisma.audioSubmission.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 })
  return res.json({ submissions })
})

router.post('/submissions/:id/review', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const body = z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().optional() }).parse(req.body)
  const submission = await prisma.audioSubmission.update({ where: { id: req.params.id }, data: { status: body.status, reviewedBy: req.user.id, reviewedAt: new Date(), rejectionReason: body.reason || null } })
  await prisma.auditLog.create({ data: { actorId: req.user.id, action: `audio.${body.status}`, targetType: 'audio', targetId: submission.id, metadata: { reason: body.reason || null } } })
  return res.json({ submission })
})

export default router
