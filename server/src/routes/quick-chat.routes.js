import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { canUseQuickChat, isModerator } from '../lib/permissions.js'
import { inspectProfanity } from '../lib/profanity.js'

const router = Router()
const categories = ['reaction', 'question', 'feedback', 'praise', 'humor']
const suggestionSchema = z.object({ phraseText: z.string().trim().min(1).max(80), category: z.enum(categories) })

router.get('/phrases', async (_req, res) => {
  const phrases = await prisma.quickChatPhrase.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { phraseText: 'asc' }] })
  return res.json({ phrases })
})

router.post('/suggestions', requireAuth, async (req, res) => {
  if (!canUseQuickChat(req.user)) return res.status(403).json({ message: 'Age verification required for quick chat' })
  const parsed = suggestionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid suggestion' })
  const profanity = inspectProfanity(parsed.data.phraseText)
  if (!profanity.clean) return res.status(400).json({ message: 'Suggestion failed profanity review' })
  const [existingSuggestion, existingPhrase, recentCount] = await Promise.all([
    prisma.quickChatSuggestion.findUnique({ where: { normalized: profanity.normalized } }),
    prisma.quickChatPhrase.findFirst({ where: { phraseText: { equals: parsed.data.phraseText, mode: 'insensitive' } } }),
    prisma.quickChatSuggestion.count({ where: { submittedBy: req.user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
  ])
  if (recentCount >= 5) return res.status(429).json({ message: 'Quick chat suggestion rate limit reached' })
  if (existingSuggestion || existingPhrase) return res.status(409).json({ message: 'Duplicate suggestion' })
  const suggestion = await prisma.quickChatSuggestion.create({
    data: { phraseText: parsed.data.phraseText, normalized: profanity.normalized, category: parsed.data.category, submittedBy: req.user.id },
  })
  return res.status(201).json({ suggestion })
})

router.get('/suggestions/pending', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const suggestions = await prisma.quickChatSuggestion.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 })
  return res.json({ suggestions })
})

router.post('/suggestions/:id/review', requireAuth, async (req, res) => {
  if (!isModerator(req.user)) return res.status(403).json({ message: 'Moderator access required' })
  const body = z.object({ status: z.enum(['approved', 'rejected']) }).parse(req.body)
  const suggestion = await prisma.quickChatSuggestion.update({ where: { id: req.params.id }, data: { status: body.status, reviewedBy: req.user.id, reviewedAt: new Date() } })
  await prisma.auditLog.create({ data: { actorId: req.user.id, action: `quick_chat.${body.status}`, targetType: 'quick_chat', targetId: suggestion.id } })
  if (body.status === 'approved') {
    await prisma.quickChatPhrase.upsert({ where: { phraseText: suggestion.phraseText }, update: { active: true, category: suggestion.category }, create: { phraseText: suggestion.phraseText, category: suggestion.category } })
  }
  return res.json({ suggestion })
})

export default router
