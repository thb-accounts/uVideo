import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { mapDiditResult } from '../lib/didit.js'

const router = Router()

const diditResultSchema = z.object({
  userId: z.string().min(1),
  provider: z.literal('didit').default('didit'),
  result: z.string().optional(),
  verificationStatus: z.string().optional(),
  age_result: z.string().optional(),
  minimumAge: z.number().optional(),
  ageRange: z.string().optional(),
  passed: z.boolean().optional(),
  threshold: z.number().optional(),
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

  const { userId } = parsed.data
  const result = mapDiditResult(parsed.data)
  if (!result) return res.json({ stored: false })

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
