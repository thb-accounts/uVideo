import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { inspectProfanity } from '../lib/profanity.js'

const router = Router()

function generatedAvatar(user) {
  return {
    seed: user.generatedAvatarSeed || user.username,
    variant: user.generatedAvatarVariant || 'animal',
  }
}

router.get('/:username', async (req, res) => {
  const { username } = req.params
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      fullName: true,
      generatedAvatarSeed: true,
      generatedAvatarVariant: true,
      createdAt: true,
      videos: {
        where: { status: 'approved', visibility: 'public' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, caption: true, title: true, cloudfrontUrl: true, thumbnailUrl: true, createdAt: true },
      },
      _count: { select: { videos: true } },
    },
  })

  if (!user) return res.status(404).json({ message: 'User not found' })
  const totalViews = 0
  return res.json({ user: { ...user, generatedAvatar: generatedAvatar(user), videoCount: user._count.videos, totalViews } })
})

router.patch('/me/profile', requireAuth, async (req, res) => {
  const schema = z.object({ fullName: z.string().trim().min(1).max(80).optional(), privacy: z.enum(['public', 'private']).optional() }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Profiles only support display name and privacy updates' })
  if (parsed.data.fullName && !inspectProfanity(parsed.data.fullName).clean) return res.status(400).json({ message: 'Display name failed profanity review' })
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: parsed.data,
    select: { id: true, email: true, username: true, fullName: true, generatedAvatarSeed: true, generatedAvatarVariant: true, privacy: true, createdAt: true },
  })
  return res.json({ user: { ...user, generatedAvatar: generatedAvatar(user) } })
})

export default router
