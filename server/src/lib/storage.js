import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function requiredStorageEnv() {
  return {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    cloudfrontBaseUrl: process.env.CLOUDFRONT_BASE_URL,
  }
}

function extensionFromKey(key = '', fallback = 'mp4') {
  const match = key.match(/\.([a-z0-9]+)$/i)
  return match?.[1] || fallback
}

function getS3Client() {
  const { region } = requiredStorageEnv()
  if (!region) {
    const error = new Error('AWS_REGION must be configured before S3 operations are enabled')
    error.status = 503
    throw error
  }
  return new S3Client({ region })
}

export function buildPendingVideoKey(userId, videoId, extension = 'mp4') {
  return `pending/${userId}/${videoId}.${extension.replace(/^\./, '').toLowerCase()}`
}

export function buildApprovedVideoKey(videoId, extension = 'mp4') {
  return `approved/${videoId}.${extension.replace(/^\./, '').toLowerCase()}`
}

export function buildRejectedVideoKey(videoId, extension = 'mp4') {
  return `rejected/${videoId}.${extension.replace(/^\./, '').toLowerCase()}`
}

export function cloudfrontUrlForKey(key) {
  const { cloudfrontBaseUrl } = requiredStorageEnv()
  if (!cloudfrontBaseUrl || !key) return null
  return `${cloudfrontBaseUrl.replace(/\/$/, '')}/${key}`
}

export async function createPresignedPutUrl({ key, contentType }) {
  const { bucket } = requiredStorageEnv()
  if (!bucket) {
    const error = new Error('AWS_S3_BUCKET must be configured before uploads are enabled')
    error.status = 503
    throw error
  }

  const client = getS3Client()
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 })
  return { uploadUrl, key, expiresIn: 600 }
}

export async function moveS3Object({ fromKey, toKey }) {
  const { bucket } = requiredStorageEnv()
  if (!bucket) {
    const error = new Error('AWS_S3_BUCKET must be configured before S3 moderation is enabled')
    error.status = 503
    throw error
  }
  if (!fromKey || !toKey) throw new Error('Both source and destination S3 keys are required')

  const client = getS3Client()
  await client.send(new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`, Key: toKey }))
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fromKey }))
  return { key: toKey }
}

export async function moveVideoForModeration({ currentKey, videoId, status }) {
  const extension = extensionFromKey(currentKey)
  const destinationKey = status === 'approved' ? buildApprovedVideoKey(videoId, extension) : buildRejectedVideoKey(videoId, extension)
  await moveS3Object({ fromKey: currentKey, toKey: destinationKey })
  return { key: destinationKey, cloudfrontUrl: status === 'approved' ? cloudfrontUrlForKey(destinationKey) : null }
}
