import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { cleanupMulterTempFile } from '../lib/multerCleanup.js'
import {
  cleanEnvValue,
  cleanFolder,
  isPlaceholderValue,
  rateLimitUploadPermission,
  requireUploadAuth,
  validateUploadRequest,
} from '../lib/uploadValidation.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
})

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

router.post('/upload', requireUploadAuth, rateLimitUploadPermission, upload.single('video'), async (req, res, next) => {
  const file = req.file

  try {
    const config = getCloudinaryConfig()
    if (!config) return res.status(503).json({ message: 'Cloudinary uploads are not configured yet.' })
    if (!file) return res.status(400).json({ message: 'No file uploaded.' })

    const validated = validateUploadRequest({
      fileName: file.originalname,
      contentType: file.mimetype,
      size: file.size,
    })
    if (validated.error) return res.status(400).json({ message: validated.error })

    const timestamp = Math.floor(Date.now() / 1000)
    const publicId = safePublicId(validated.sanitizedFileName)
    const params = { folder: config.folder, public_id: publicId, timestamp }
    const signature = signUploadParams(params, config.apiSecret)
    const formData = new FormData()
    formData.append('file', new Blob([file.buffer], { type: validated.contentType }), file.originalname)
    formData.append('api_key', config.apiKey)
    formData.append('timestamp', String(timestamp))
    formData.append('signature', signature)
    formData.append('public_id', publicId)
    if (config.folder) formData.append('folder', config.folder)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`, {
      method: 'POST',
      body: formData,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(body.error?.message || `Cloudinary upload failed with status ${response.status}.`)
      error.status = response.status
      throw error
    }

    return res.json({
      provider: 'cloudinary',
      mediaUrl: body.secure_url || body.url,
      publicId: body.public_id,
      resourceType: body.resource_type,
    })
  } catch (error) {
    return next(error)
  } finally {
    await cleanupMulterTempFile(file, 'cloudinary-upload')
  }
})

export default router
