import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Router } from 'express'
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
const PRESIGN_EXPIRES_SECONDS = 10 * 60

function getBackblazeConfig() {
  const keyId = cleanEnvValue(process.env.BACKBLAZE_B2_KEY_ID)
  const applicationKey = cleanEnvValue(process.env.BACKBLAZE_B2_APPLICATION_KEY)
  const bucketName = cleanEnvValue(process.env.BACKBLAZE_B2_BUCKET_NAME)
  const endpoint = cleanEnvValue(process.env.BACKBLAZE_B2_S3_ENDPOINT)
  const region = cleanEnvValue(process.env.BACKBLAZE_B2_REGION)
  const folder = cleanFolder(process.env.BACKBLAZE_B2_UPLOAD_FOLDER)
  const bunnyCdnBaseUrl = cleanEnvValue(process.env.BUNNY_CDN_BASE_URL).replace(/\/+$/g, '')

  const requiredValues = [keyId, applicationKey, bucketName, endpoint, region, bunnyCdnBaseUrl]
  if (requiredValues.some((value) => !value || isPlaceholderValue(value))) return null
  return { keyId, applicationKey, bucketName, endpoint, region, folder, bunnyCdnBaseUrl }
}

router.post('/presign-upload', requireUploadAuth, rateLimitUploadPermission, async (req, res, next) => {
  try {
    const config = getBackblazeConfig()
    if (!config) {
      return res.status(503).json({ message: 'Backblaze B2 uploads are not configured yet.' })
    }

    const validated = validateUploadRequest(req.body)
    if (validated.error) return res.status(400).json({ message: validated.error })

    const storageKey = buildStorageKey({ folder: config.folder, sanitizedFileName: validated.sanitizedFileName })
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.keyId,
        secretAccessKey: config.applicationKey,
      },
    })
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
      ContentType: validated.contentType,
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS })
    const expiresAt = new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000).toISOString()

    return res.json({
      provider: 'backblaze',
      uploadUrl,
      storageKey,
      playbackUrl: `${config.bunnyCdnBaseUrl}/${storageKey}`,
      expiresAt,
    })
  } catch (error) {
    return next(error)
  }
})

export default router
