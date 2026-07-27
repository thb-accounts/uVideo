import { createHmac, timingSafeEqual } from 'node:crypto'
import { cleanEnvValue } from './uploadValidation.js'

export const DIDIT_MINIMUM_AGE = 15

function sortForSignature(value) {
  if (Array.isArray(value)) return value.map(sortForSignature)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortForSignature(value[key])
      return result
    }, {})
  }
  return value
}

export function canonicalJson(value) {
  return JSON.stringify(sortForSignature(value))
}

export function verifyDiditWebhook({ body, rawBody, signatureV2, signature, timestamp }) {
  const secret = cleanEnvValue(process.env.DIDIT_WEBHOOK_SECRET)
  if (!secret || !timestamp || (!signatureV2 && !signature)) return false

  const parsedTimestamp = Number(timestamp)
  if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() / 1000 - parsedTimestamp) > 300) return false

  const payload = signatureV2 ? canonicalJson(body) : rawBody
  if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return false
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const received = String(signatureV2 || signature).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(received)) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
}

export function normalizeDiditStatus(status) {
  const statuses = {
    Approved: 'approved',
    Declined: 'declined',
    'In Review': 'in_review',
    'In Progress': 'in_progress',
    Abandoned: 'abandoned',
    Expired: 'expired',
    'Not Started': 'not_started',
  }
  return statuses[status] || 'pending'
}
