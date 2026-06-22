import { createHash } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { cleanupMulterTempFile } from '../lib/multerCleanup.js'
import {
  buildStorageKey,
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

function getBackblazeConfig() {
  const keyId = cleanEnvValue(process.env.BACKBLAZE_B2_KEY_ID)
  const applicationKey = cleanEnvValue(process.env.BACKBLAZE_B2_APPLICATION_KEY)
  const bucketId = cleanEnvValue(process.env.BACKBLAZE_B2_BUCKET_ID)
  const bucketName = cleanEnvValue(process.env.BACKBLAZE_B2_BUCKET_NAME)
  const folder = cleanFolder(process.env.BACKBLAZE_B2_UPLOAD_FOLDER)
  const bunnyCdnBaseUrl = cleanEnvValue(process.env.BUNNY_CDN_BASE_URL).replace(/\/+$/g, '')

  const requiredValues = [keyId, applicationKey, bucketId, bucketName, bunnyCdnBaseUrl]
  if (requiredValues.some((value) => !value || isPlaceholderValue(value))) return null
  return { keyId, applicationKey, bucketId, bucketName, folder, bunnyCdnBaseUrl }
}

async function parseJsonResponse(response) {
  return response.json().catch(() => null)
}

async function uploadToBackblaze({ file, config, validated }) {
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

  const storageKey = buildStorageKey({ folder: config.folder, sanitizedFileName: validated.sanitizedFileName })
  const sha1 = createHash('sha1').update(file.buffer).digest('hex')
  const fileUploadResponse = await fetch(uploadUrlBody.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadUrlBody.authorizationToken,
      'Content-Type': validated.contentType,
      'Content-Length': String(validated.fileSize),
      'X-Bz-File-Name': encodeURIComponent(storageKey),
      'X-Bz-Content-Sha1': sha1,
    },
    body: file.buffer,
  })
  const fileUploadBody = await parseJsonResponse(fileUploadResponse)

  return {
    ok: fileUploadResponse.ok,
    status: fileUploadResponse.status,
    responseBody: fileUploadBody,
    mediaUrl: `${config.bunnyCdnBaseUrl}/${storageKey}`,
    storageKey,
  }
}

router.post('/upload', requireUploadAuth, rateLimitUploadPermission, upload.single('video'), async (req, res, next) => {
  const file = req.file

  try {
    const config = getBackblazeConfig()
    if (!config) {
      return res.status(503).json({ message: 'Backblaze B2 uploads are not configured yet.' })
    }
    if (!file) return res.status(400).json({ message: 'No file uploaded.' })

    const validated = validateUploadRequest({
      fileName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size,
    })
    if (validated.error) return res.status(400).json({ message: validated.error })

    const uploadResult = await uploadToBackblaze({ file, config, validated })
    if (!uploadResult.ok) {
      return res.status(502).json({
        message: uploadResult.responseBody?.message || uploadResult.responseBody?.code || 'Backblaze B2 could not store this video.',
      })
    }

    return res.status(201).json({
      provider: 'backblaze',
      mediaUrl: uploadResult.mediaUrl,
      storageKey: uploadResult.storageKey,
      fileId: uploadResult.responseBody?.fileId,
      fileName: uploadResult.responseBody?.fileName,
    })
  } catch (error) {
    return next(error)
  } finally {
    await cleanupMulterTempFile(file, 'backblaze-upload')
  }
})

export default router
