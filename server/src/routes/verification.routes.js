import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import {
  DIDIT_SESSION_URL,
  DIDIT_WEBHOOK_STATUSES,
  DIDIT_WORKFLOW_ID,
  alreadyProcessedDiditEvent,
  markDiditEventProcessed,
  mapDiditResult,
  verifyDiditWebhookSignature,
} from '../lib/didit.js'

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

function getCallbackUrl(req) {
  const configuredOrigin = process.env.CORS_ORIGIN || `${req.protocol}://${req.get('host')}`
  return new URL('/settings?verification=complete', configuredOrigin).toString()
}

async function updateUserVerification({ vendorData, verificationStatus, verifiedAt = undefined }) {
  if (!vendorData) return false

  await prisma.user.update({
    where: { id: vendorData },
    data: {
      verificationStatus,
      verificationProvider: 'didit',
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
    },
  })
  return true
}

router.post('/didit/start', requireAuth, async (req, res) => {
  if (!process.env.DIDIT_API_KEY) {
    return res.status(500).json({ message: 'Didit API key is not configured' })
  }

  const diditResponse = await fetch(DIDIT_SESSION_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.DIDIT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: req.user.id,
      callback: getCallbackUrl(req),
    }),
  })

  if (!diditResponse.ok) {
    const detail = await diditResponse.text()
    return res.status(502).json({ message: 'Didit session create failed', detail })
  }

  const session = await diditResponse.json()
  return res.json({ url: session.url, session_id: session.session_id })
})

router.post('/didit/webhook', async (req, res) => {
  const verification = verifyDiditWebhookSignature({
    body: req.body,
    signature: req.get('x-signature-v2') || '',
    timestamp: req.get('x-timestamp'),
    secret: process.env.DIDIT_WEBHOOK_SECRET,
  })

  if (!verification.ok) return res.status(401).send(verification.reason)

  const event = req.body || {}
  if (await alreadyProcessedDiditEvent(event.event_id)) return res.send('ok')
  await markDiditEventProcessed(event.event_id)

  if (!DIDIT_WEBHOOK_STATUSES.includes(event.status)) {
    console.warn('Ignoring Didit webhook with unknown status:', event.status)
    return res.send('ok')
  }

  try {
    switch (event.status) {
      case 'Approved':
        await updateUserVerification({
          vendorData: event.vendor_data,
          verificationStatus: 'verified_18_plus',
          verifiedAt: new Date(),
        })
        break
      case 'Declined':
      case 'Kyc Expired':
        await updateUserVerification({
          vendorData: event.vendor_data,
          verificationStatus: 'unverified',
          verifiedAt: null,
        })
        break
      case 'In Review':
      case 'In Progress':
      case 'Awaiting User':
      case 'Resubmitted':
      case 'Abandoned':
      case 'Expired':
      case 'Not Started':
        console.info('Didit verification status update:', {
          event_id: event.event_id,
          session_id: event.session_id,
          status: event.status,
          vendor_data: event.vendor_data,
        })
        break
      default:
        break
    }
  } catch (error) {
    console.error('Didit webhook persistence failed:', error)
  }

  return res.send('ok')
})

router.post('/didit/legacy-webhook', async (req, res) => {
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
