import { createClient } from '@supabase/supabase-js'
import { prisma } from '../lib/prisma.js'

const userSelect = {
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
}

let supabaseAdminClient

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
}

export function createSupabaseAuthClient() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured')
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return supabaseAdminClient
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildUsername(supabaseUser) {
  const metadata = supabaseUser.user_metadata || {}
  const raw = safeText(metadata.username) || safeText(metadata.user_name) || safeText(supabaseUser.email?.split('@')[0]) || `user-${supabaseUser.id.slice(0, 8)}`
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
  return normalized || `user_${supabaseUser.id.slice(0, 8)}`
}

function buildFullName(supabaseUser, username) {
  const metadata = supabaseUser.user_metadata || {}
  return safeText(metadata.full_name) || safeText(metadata.fullName) || safeText(metadata.name) || safeText(supabaseUser.email?.split('@')[0]) || username
}

export function mapSupabaseUserToPrismaData(supabaseUser) {
  const username = buildUsername(supabaseUser)
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    username,
    fullName: buildFullName(supabaseUser, username),
    passwordHash: 'supabase-auth-managed',
    verificationStatus: 'unverified',
    generatedAvatarSeed: username || supabaseUser.id,
    generatedAvatarVariant: 'animal',
  }
}

export async function findOrCreateUserFromSupabase(supabaseUser, prismaClient = prisma) {
  const existing = await prismaClient.user.findUnique({ where: { id: supabaseUser.id }, select: userSelect })
  if (existing) return existing

  const data = mapSupabaseUserToPrismaData(supabaseUser)
  const createWithUsername = async (username) => prismaClient.user.create({
    data: { ...data, username, generatedAvatarSeed: data.generatedAvatarSeed || username },
    select: userSelect,
  })

  try {
    return await createWithUsername(data.username)
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    return createWithUsername(`${data.username}_${supabaseUser.id.slice(0, 8)}`.slice(0, 36))
  }
}

export async function authenticateSupabaseToken(token, supabaseClient = createSupabaseAuthClient(), prismaClient = prisma) {
  const { data, error } = await supabaseClient.auth.getUser(token)

  if (error || !data?.user?.id || !data.user.email) {
    return null
  }

  return findOrCreateUserFromSupabase(data.user, prismaClient)
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const user = await authenticateSupabaseToken(token)
    if (!user) return res.status(401).json({ message: 'Invalid or expired token' })

    req.user = user
    return next()
  } catch (error) {
    if (error.message === 'Supabase server credentials are not configured') {
      console.error(error.message)
    }
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
