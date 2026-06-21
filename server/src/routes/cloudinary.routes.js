import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
})
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

function safePublicId(originalName = 'upload') {
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'upload'

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

async function uploadToCloudinary({ file, resourceType, config }) {
  const publicId = safePublicId(file.originalname)
  const timestamp = Math.floor(Date.now() / 1000)
  const uploadParams = {
    folder: config.folder,
    public_id: publicId,
    timestamp,
  }
  const signature = signUploadParams(uploadParams, config.apiSecret)
  const formData = new FormData()

  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
  formData.append('api_key', config.apiKey)
  formData.append('folder', uploadParams.folder)
  formData.append('public_id', uploadParams.public_id)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  })

  const responseBody = await cloudinaryResponse.json().catch(() => null)
  return { cloudinaryResponse, responseBody }
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

  const { cloudinaryResponse, responseBody } = await uploadToCloudinary({ file: req.file, resourceType: 'video', config })

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

router.post('/upload-thumbnail', thumbnailUpload.single('thumbnail'), async (req, res) => {
  const config = getCloudinaryConfig()
  if (!config) {
    return res.status(503).json({
      message: 'Cloudinary uploads are not configured yet. Add Cloudinary env vars in Vercel Project Settings, redeploy, or paste a thumbnail URL instead.',
    })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Choose a thumbnail image to upload.' })
  }

  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ message: 'Only image files can be uploaded as thumbnails.' })
  }

  const { cloudinaryResponse, responseBody } = await uploadToCloudinary({ file: req.file, resourceType: 'image', config })

  if (!cloudinaryResponse.ok) {
    return res.status(502).json({
      message: responseBody?.error?.message || 'Cloudinary could not store this thumbnail. Paste a thumbnail URL instead.',
    })
  }

  return res.status(201).json({
    thumbnailUrl: responseBody.secure_url,
    publicId: responseBody.public_id,
  })
})

export default router
