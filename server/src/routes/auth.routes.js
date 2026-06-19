import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signToken } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    generatedAvatarSeed: user.generatedAvatarSeed,
    generatedAvatarVariant: user.generatedAvatarVariant,
    role: user.role,
    verificationStatus: user.verificationStatus,
    verificationProvider: user.verificationProvider,
    verifiedAt: user.verifiedAt,
    privacy: user.privacy,
    createdAt: user.createdAt,
  }
}

router.post('/register', async (req, res) => {
  const { email, password, username, fullName } = req.body

  if (!email || !password || !username || !fullName) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })
  if (existing) {
    return res.status(409).json({ message: 'Email or username already in use' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      username,
      fullName,
      passwordHash,
      privacy: 'public',
      verificationStatus: 'unverified',
      generatedAvatarSeed: username.toLowerCase(),
      generatedAvatarVariant: 'animal',
    },
  })

  const token = signToken({ userId: user.id })
  return res.status(201).json({ token, user: sanitizeUser(user) })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = signToken({ userId: user.id })
  return res.json({ token, user: sanitizeUser(user) })
})

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user })
})

export default router
