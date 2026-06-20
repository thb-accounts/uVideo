import crypto from 'node:crypto'

export const DIDIT_WORKFLOW_ID = '94514db5-6d66-4eb2-8b4f-df811fec95d5'
export const DIDIT_SESSION_URL = 'https://verification.didit.me/v3/session/'
export const DIDIT_WEBHOOK_STATUSES = [
  'Not Started',
  'In Progress',
  'Awaiting User',
  'In Review',
  'Approved',
  'Declined',
  'Resubmitted',
  'Abandoned',
  'Expired',
  'Kyc Expired',
]

const processedWebhookEvents = new Set()

export function mapDiditResult(payload = {}) {
  const result = payload.result || payload.verificationStatus || payload.age_result
  if (result === 'verified_18_plus' || result === '18_plus' || result === 'over_18') return 'verified_18_plus'
  if (result === 'verified_15_plus' || result === '15_plus' || result === 'over_15') return 'verified_15_plus'
  if (payload.minimumAge >= 18 || payload.ageRange === '18+') return 'verified_18_plus'
  if (payload.minimumAge >= 15 || payload.ageRange === '15+') return 'verified_15_plus'
  if (payload.passed === true && payload.threshold === 18) return 'verified_18_plus'
  if (payload.passed === true && payload.threshold === 15) return 'verified_15_plus'
  return null
}

export function shortenFloats(value) {
  if (Array.isArray(value)) return value.map(shortenFloats)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, shortenFloats(nestedValue)]),
    )
  }
  if (typeof value === 'number' && !Number.isInteger(value) && value % 1 === 0) return Math.trunc(value)
  return value
}

export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key])
        return acc
      }, {})
  }
  return value
}

export function canonicalizeDiditWebhookBody(body) {
  return JSON.stringify(sortKeys(shortenFloats(body)))
}

export function verifyDiditWebhookSignature({ body, signature, timestamp, secret, now = Date.now() }) {
  const parsedTimestamp = Number(timestamp)
  if (!parsedTimestamp || Math.abs(now / 1000 - parsedTimestamp) > 300) {
    return { ok: false, reason: 'stale' }
  }

  if (!secret || !signature) return { ok: false, reason: 'bad sig' }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(canonicalizeDiditWebhookBody(body), 'utf8')
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { ok: false, reason: 'bad sig' }
  }

  return { ok: true }
}

export async function alreadyProcessedDiditEvent(eventId) {
  return Boolean(eventId && processedWebhookEvents.has(eventId))
}

export async function markDiditEventProcessed(eventId) {
  if (eventId) processedWebhookEvents.add(eventId)
}
