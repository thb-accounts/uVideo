import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
])

export const DEFAULT_MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024

export function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isPlaceholderValue(value) {
  return /^your[-_]/i.test(value) || /^https:\/\/your[-.]/i.test(value)
}

export function getMaxVideoUploadBytes() {
  const configured = Number(process.env.MAX_VIDEO_UPLOAD_BYTES)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_VIDEO_UPLOAD_BYTES
}

function sanitizeFileName(fileName = 'upload.mp4') {
  const leafName = String(fileName).split(/[\\/]/).pop() || 'upload.mp4'
  const extensionMatch = leafName.match(/\.[a-z0-9]{1,12}$/i)
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.mp4'
  const baseName = leafName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload'
  return `${baseName}${extension}`
}

export function cleanFolder(folder, fallback = 'simplichill/videos') {
  const cleaned = cleanEnvValue(folder)
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
  return cleaned || fallback
}

export function validateUploadRequest(body = {}) {
  const fileName = cleanEnvValue(body.fileName)
  const contentType = cleanEnvValue(body.contentType).toLowerCase()
  const fileSize = Number(body.fileSize)
  const maxBytes = getMaxVideoUploadBytes()

  if (!fileName || !contentType || !Number.isFinite(fileSize) || fileSize <= 0) {
    return { error: 'fileName, contentType, and a positive fileSize are required.' }
  }

  if (fileName.includes('\0') || fileName.length > 255 || /(^|[\\/])\.\.([\\/]|$)/.test(fileName)) {
    return { error: 'The file name is not allowed.' }
  }

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return { error: 'Only MP4, WebM, QuickTime, and Matroska video files are supported.' }
  }

  if (fileSize > maxBytes) {
    return { error: `Video files must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.` }
  }

  return { fileName, contentType, fileSize, sanitizedFileName: sanitizeFileName(fileName) }
}

export function validateContentMetadata(body = {}) {
  const title = cleanEnvValue(body.title)
  const description = cleanEnvValue(body.description)
  const category = cleanEnvValue(body.category || 'General')
  const type = cleanEnvValue(body.type || body.contentType || 'video').toLowerCase()
  const username = cleanEnvValue(body.username)
  const points = Number(body.points) || 20

  if (!title || title.length > 120) return { error: 'A title of 1-120 characters is required.' }
  if (!description || description.length > 2000) return { error: 'A description of 1-2000 characters is required.' }
  if (!category || category.length > 80) return { error: 'A category of 1-80 characters is required.' }
  if (!['video', 'short'].includes(type)) return { error: 'type must be video or short.' }

  return { title, description, category, type, username, points }
}

export function buildStorageKey({ folder, sanitizedFileName }) {
  return `${cleanFolder(folder)}/${Date.now()}-${randomUUID()}-${sanitizedFileName}`
}

export function getUploadAuthToken(req) {
  const authHeader = req.headers.authorization || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

export function getAuthenticatedUploadUser(req) {
  const token = getUploadAuthToken(req)
  if (!token) return null

  try {
    const [, payloadPart] = token.split('.')
    if (!payloadPart) return { id: 'authenticated' }
    const payload = JSON.parse(Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return { id: payload.sub || payload.userId || payload.id || 'authenticated' }
  } catch {
    return { id: 'authenticated' }
  }
}

// Best-effort in-memory limiter for serverless/dev. Move this to shared storage for multi-instance production enforcement.
const buckets = new Map()

export function rateLimitUploadPermission(req, res, next) {
  const userId = req.uploadUser?.id || req.ip || 'anonymous'
  const now = Date.now()
  const windowMs = 10 * 60 * 1000
  const maxRequests = 20
  const bucket = buckets.get(userId) || { count: 0, resetAt: now + windowMs }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }
  bucket.count += 1
  buckets.set(userId, bucket)
  if (bucket.count > maxRequests) return res.status(429).json({ message: 'Too many upload requests. Please wait a few minutes and try again.' })
  return next()
}

export async function requireUploadAuth(req, res, next) {
  const token = getUploadAuthToken(req)
  if (!token) return res.status(401).json({ message: 'Authentication required' })

  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const key = cleanEnvValue(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
  if (url && key && !isPlaceholderValue(url) && !isPlaceholderValue(key)) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ message: 'Authentication required' })
    req.uploadUser = { id: data.user.id, email: data.user.email || null }
    return next()
  }

  const uploadUser = getAuthenticatedUploadUser(req)
  if (!uploadUser) return res.status(401).json({ message: 'Authentication required' })
  req.uploadUser = uploadUser
  return next()
}
