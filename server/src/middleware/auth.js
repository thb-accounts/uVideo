import { prisma } from '../lib/prisma.js'
import { verifyToken } from '../lib/jwt.js'

function firebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
}

async function verifyFirebaseIdToken(token) {
  const projectId = firebaseProjectId()
  if (!projectId) throw new Error('Firebase project ID is not configured')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed Firebase token')
  const [headerPart, payloadPart, signaturePart] = parts
  const decode = (part) => JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  const header = decode(headerPart)
  const payload = decode(payloadPart)
  const now = Math.floor(Date.now() / 1000)

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Firebase token header')
  if (payload.aud !== projectId) throw new Error('Invalid Firebase token audience')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid Firebase token issuer')
  if (!payload.sub || payload.sub.length > 128) throw new Error('Invalid Firebase token subject')
  if (!payload.exp || payload.exp <= now || !payload.iat || payload.iat > now) throw new Error('Expired or invalid Firebase token')

  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
  if (!response.ok) throw new Error('Could not load Firebase signing certificates')
  const certs = await response.json()
  const certificate = certs[header.kid]
  if (!certificate) throw new Error('Unknown Firebase signing key')

  const { createPublicKey, verify } = await import('node:crypto')
  const signature = Buffer.from(signaturePart.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (!verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), createPublicKey(certificate), signature)) {
    throw new Error('Invalid Firebase token signature')
  }
  return payload
}

const userSelect = { id: true, email: true, username: true, fullName: true, bio: true, avatarUrl: true, privacy: true }

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required' })

  try {
    const firebasePayload = await verifyFirebaseIdToken(token)
    const user = firebasePayload.email
      ? await prisma.user.findUnique({ where: { email: firebasePayload.email }, select: userSelect })
      : null
    if (!user) return res.status(401).json({ message: 'No MPlace Videos account matches this Firebase user' })
    req.user = user
    req.firebaseUser = firebasePayload
    return next()
  } catch (firebaseError) {
    try {
      const payload = verifyToken(token)
      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: userSelect })
      if (!user) return res.status(401).json({ message: 'Invalid token' })
      req.user = user
      return next()
    } catch {
      console.warn('Authentication rejected:', firebaseError?.message || 'Invalid token')
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
  }
}
