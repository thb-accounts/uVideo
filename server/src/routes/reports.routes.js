import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { isModerator } from '../lib/permissions.js'

const router = Router()

router.post('/', requireAuth, async (req, res) => {
  const body = z.object({ targetType: z.enum(['video', 'audio', 'user', 'quick_chat']), targetId: z.string().min(1), reason: z.string().trim().min(1).max(500) }).parse(req.body)
  const report = await prisma.report.create({ data: { ...body, reportedBy: req.user.id } })
  return res.status(201).json({ report })
})

router.get('/moderation', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const reports = await prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return res.json({ reports })
})

router.post('/:id/review', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const body = z.object({ status: z.enum(['approved', 'rejected']) }).parse(req.body)
  const report = await prisma.report.update({ where: { id: req.params.id }, data: { status: body.status, reviewedBy: req.user.id, reviewedAt: new Date() } })
  await prisma.auditLog.create({ data: { actorId: req.user.id, action: `report.${body.status}`, targetType: 'report', targetId: report.id } })
  return res.json({ report })
})

router.get('/audit-logs', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return res.json({ auditLogs })
})

export default router
