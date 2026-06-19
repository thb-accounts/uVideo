function requiredStorageEnv() {
  return {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    cloudfrontBaseUrl: process.env.CLOUDFRONT_BASE_URL,
  }
}

export function buildPendingVideoKey(userId, videoId, extension = 'mp4') {
  return `pending/${userId}/${videoId}.${extension.replace(/^\./, '')}`
}

export function buildApprovedVideoKey(videoId, extension = 'mp4') {
  return `approved/${videoId}.${extension.replace(/^\./, '')}`
}

export function cloudfrontUrlForKey(key) {
  const { cloudfrontBaseUrl } = requiredStorageEnv()
  if (!cloudfrontBaseUrl) return null
  return `${cloudfrontBaseUrl.replace(/\/$/, '')}/${key}`
}

export async function createPresignedPutUrl({ key, contentType }) {
  const { region, bucket } = requiredStorageEnv()
  if (!region || !bucket) {
    const error = new Error('AWS_REGION and AWS_S3_BUCKET must be configured before uploads are enabled')
    error.status = 503
    throw error
  }

  let aws
  let presigner
  try {
    aws = await import('@aws-sdk/client-s3')
    presigner = await import('@aws-sdk/s3-request-presigner')
  } catch {
    const error = new Error('Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner to enable S3 presigned uploads')
    error.status = 503
    throw error
  }

  const client = new aws.S3Client({ region })
  const command = new aws.PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  const uploadUrl = await presigner.getSignedUrl(client, command, { expiresIn: 600 })
  return { uploadUrl, key, expiresIn: 600 }
}
