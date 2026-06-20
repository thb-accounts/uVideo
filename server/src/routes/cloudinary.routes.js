import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
})

function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isPlaceholderValue(value) {
  return /^your[-_]/i.test(value) || /^https:\/\/your[-.]/i.test(value)
}

function getCloudinaryConfig() {
  const cloudName = cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME)
  const apiKey = cleanEnvValue(process.env.CLOUDINARY_API_KEY)
  const apiSecret = cleanEnvValue(process.env.CLOUDINARY_API_SECRET)
  const folder = cleanEnvValue(process.env.CLOUDINARY_UPLOAD_FOLDER) || 'uvideo'

  const requiredValues = [cloudName, apiKey, apiSecret]
  if (requiredValues.some((value) => !value || isPlaceholderValue(value))) {
    return null
  }

  return { cloudName, apiKey, apiSecret, folder }
}

function safePublicId(originalName = 'video.mp4') {
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'video'

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

router.post('/upload', upload.single('video'), async (req, res) => {
  const config = getCloudinaryConfig()
  if (!config) {
    return res.status(503).json({
      message: 'Cloudinary uploads are not configured yet. Add Cloudinary env vars in Vercel Project Settings, redeploy, or use a direct MP4 link instead.',
    })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Choose a video file to upload.' })
  }

  if (!req.file.mimetype.startsWith('video/')) {
    return res.status(400).json({ message: 'Only video files can be uploaded.' })
  }

  const publicId = safePublicId(req.file.originalname)
  const timestamp = Math.floor(Date.now() / 1000)
  const uploadParams = {
    folder: config.folder,
    public_id: publicId,
    timestamp,
  }
  const signature = signUploadParams(uploadParams, config.apiSecret)
  const formData = new FormData()

  formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname)
  formData.append('api_key', config.apiKey)
  formData.append('folder', uploadParams.folder)
  formData.append('public_id', uploadParams.public_id)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`, {
    method: 'POST',
    body: formData,
  })

  const responseBody = await cloudinaryResponse.json().catch(() => null)

  if (!cloudinaryResponse.ok) {
    return res.status(502).json({
      message: responseBody?.error?.message || 'Cloudinary could not store this video. Use a direct MP4 link instead.',
    })
  }

  return res.status(201).json({
    mediaUrl: responseBody.secure_url,
    publicId: responseBody.public_id,
  })
})

export default router
