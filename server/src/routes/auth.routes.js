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
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    privacy: user.privacy,
    createdAt: user.createdAt,
  }
}

router.post('/register', async (req, res) => {
  return res.status(403).json({
    message: 'Sorry, at the moment, our app is view-only, due to laws that we are legally required to comply with, we can only allow users to send requests for videos to add, Visit https://forms.gle/8LEGUUGmpbiGg8Gy5 to send us a video request!',
  })
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
