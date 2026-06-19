import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const diditResultSchema = z.object({
  userId: z.string().min(1),
  provider: z.literal('didit').default('didit'),
  result: z.enum(['verified_15_plus', 'verified_18_plus', 'failed', 'under_15']),
})

router.post('/didit/start', requireAuth, async (req, res) => {
  const redirectUrl = new URL(process.env.DIDIT_VERIFICATION_URL || 'https://didit.me')
  redirectUrl.searchParams.set('external_user_id', req.user.id)
  redirectUrl.searchParams.set('provider', 'didit')
  return res.json({ provider: 'didit', redirectUrl: redirectUrl.toString() })
})

router.post('/didit/webhook', async (req, res) => {
  const expectedSecret = process.env.DIDIT_WEBHOOK_SECRET
  if (expectedSecret && req.get('x-uvideo-didit-secret') !== expectedSecret) {
    return res.status(401).json({ message: 'Invalid Didit webhook signature' })
  }

  const parsed = diditResultSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid Didit result payload' })

  const { userId, result } = parsed.data
  if (!['verified_15_plus', 'verified_18_plus'].includes(result)) {
    return res.json({ stored: false })
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationStatus: result,
      verificationProvider: 'didit',
      verifiedAt: new Date(),
    },
  })

  return res.json({ stored: true, verificationStatus: result })
})

export default router
