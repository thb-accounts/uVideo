import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import {
  cleanEnvValue,
  cleanFolder,
  isPlaceholderValue,
  rateLimitUploadPermission,
  requireUploadAuth,
  validateUploadRequest,
} from '../lib/uploadValidation.js'

const router = Router()
function getCloudinaryConfig() {
  const cloudName = cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME)
  const apiKey = cleanEnvValue(process.env.CLOUDINARY_API_KEY)
  const apiSecret = cleanEnvValue(process.env.CLOUDINARY_API_SECRET)
  const folder = cleanFolder(process.env.CLOUDINARY_UPLOAD_FOLDER)
  const requiredValues = [cloudName, apiKey, apiSecret]
  if (requiredValues.some((value) => !value || isPlaceholderValue(value))) return null
  return { cloudName, apiKey, apiSecret, folder }
}

function safePublicId(originalName = 'upload') {
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload'
  return `${Date.now()}-${randomUUID()}-${baseName}`
}

function signUploadParams(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex')
}

router.post('/sign-upload', requireUploadAuth, rateLimitUploadPermission, (req, res) => {
  const config = getCloudinaryConfig()
  if (!config) return res.status(503).json({ message: 'Cloudinary uploads are not configured yet.' })

  const validated = validateUploadRequest(req.body)
  if (validated.error) return res.status(400).json({ message: validated.error })

  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = safePublicId(validated.sanitizedFileName)
  const params = { folder: config.folder, public_id: publicId, timestamp }
  const signature = signUploadParams(params, config.apiSecret)

  return res.json({
    provider: 'cloudinary',
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder: config.folder,
    publicId,
    resourceType: 'video',
  })
})

export default router
