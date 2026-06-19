import { prisma } from '../lib/prisma.js'
import { verifyToken } from '../lib/jwt.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        generatedAvatarSeed: true,
        generatedAvatarVariant: true,
        privacy: true,
        role: true,
        verificationStatus: true,
        verificationProvider: true,
        verifiedAt: true,
      },
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.user = user
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
