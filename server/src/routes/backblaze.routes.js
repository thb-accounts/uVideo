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

function getBackblazeConfig() {
  const keyId = cleanEnvValue(process.env.BACKBLAZE_B2_KEY_ID)
  const applicationKey = cleanEnvValue(process.env.BACKBLAZE_B2_APPLICATION_KEY)
  const bucketId = cleanEnvValue(process.env.BACKBLAZE_B2_BUCKET_ID)
  const bucketName = cleanEnvValue(process.env.BACKBLAZE_B2_BUCKET_NAME)
  const folder = cleanEnvValue(process.env.BACKBLAZE_B2_UPLOAD_FOLDER) || 'simplichill'

  const requiredValues = [keyId, applicationKey, bucketId, bucketName]
  if (requiredValues.some((value) => !value || isPlaceholderValue(value))) {
    return null
  }

  return { keyId, applicationKey, bucketId, bucketName, folder }
}

function safeFileName(originalName = 'upload.mp4', folder = 'simplichill') {
  const extensionMatch = originalName.match(/\.[a-z0-9]+$/i)
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.mp4'
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'upload'
  const cleanFolder = folder
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')

  return `${cleanFolder}/${Date.now()}-${randomUUID()}-${baseName}${extension}`
}

async function parseJsonResponse(response) {
  return response.json().catch(() => null)
}

async function uploadToBackblaze({ file, config }) {
  const authorization = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString('base64')
  const authorizeResponse = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${authorization}` },
  })
  const authorizeBody = await parseJsonResponse(authorizeResponse)

  if (!authorizeResponse.ok) {
    return { ok: false, status: authorizeResponse.status, responseBody: authorizeBody }
  }

  const storageApi = authorizeBody?.apiInfo?.storageApi
  const apiUrl = storageApi?.apiUrl
  const downloadUrl = storageApi?.downloadUrl
  const accountAuthToken = authorizeBody?.authorizationToken

  const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: accountAuthToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: config.bucketId }),
  })
  const uploadUrlBody = await parseJsonResponse(uploadUrlResponse)

  if (!uploadUrlResponse.ok) {
    return { ok: false, status: uploadUrlResponse.status, responseBody: uploadUrlBody }
  }

  const fileName = safeFileName(file.originalname, config.folder)
  const sha1 = createHash('sha1').update(file.buffer).digest('hex')
  const fileUploadResponse = await fetch(uploadUrlBody.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadUrlBody.authorizationToken,
      'Content-Type': file.mimetype,
      'Content-Length': String(file.size),
      'X-Bz-File-Name': encodeURIComponent(fileName),
      'X-Bz-Content-Sha1': sha1,
    },
    body: file.buffer,
  })
  const fileUploadBody = await parseJsonResponse(fileUploadResponse)

  return {
    ok: fileUploadResponse.ok,
    status: fileUploadResponse.status,
    responseBody: fileUploadBody,
    mediaUrl: `${downloadUrl}/file/${config.bucketName}/${fileName}`,
  }
}

router.post('/upload', upload.single('video'), async (req, res) => {
  const config = getBackblazeConfig()
  if (!config) {
    return res.status(503).json({
      message: 'Backblaze B2 uploads are not configured yet. Add Backblaze B2 env vars in Project Settings, redeploy, or use the Cloudinary fallback upload option.',
    })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Choose a video file to upload.' })
  }

  if (!req.file.mimetype.startsWith('video/')) {
    return res.status(400).json({ message: 'Only video files can be uploaded.' })
  }

  const uploadResult = await uploadToBackblaze({ file: req.file, config })

  if (!uploadResult.ok) {
    return res.status(uploadResult.status >= 400 && uploadResult.status < 500 ? 502 : 502).json({
      message: uploadResult.responseBody?.message || uploadResult.responseBody?.code || 'Backblaze B2 could not store this video. Try the Cloudinary fallback upload option.',
    })
  }

  return res.status(201).json({
    mediaUrl: uploadResult.mediaUrl,
    fileId: uploadResult.responseBody?.fileId,
    fileName: uploadResult.responseBody?.fileName,
  })
})

export default router
