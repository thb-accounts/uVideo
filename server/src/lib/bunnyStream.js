import { createHash } from 'node:crypto'
import { cleanEnvValue, isPlaceholderValue } from './uploadValidation.js'

const API_BASE = 'https://video.bunnycdn.com'
const TUS_ENDPOINT = `${API_BASE}/tusupload`

export class BunnyStreamError extends Error {
  constructor(message, status = 500, code = 'BUNNY_STREAM_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function getBunnyStreamConfig() {
  const libraryId = cleanEnvValue(process.env.BUNNY_STREAM_LIBRARY_ID)
  const apiKey = cleanEnvValue(process.env.BUNNY_STREAM_API_KEY)
  const cdnHost = cleanEnvValue(process.env.BUNNY_STREAM_CDN_HOST).replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if ([libraryId, apiKey, cdnHost].some((value) => !value || isPlaceholderValue(value))) return null
  return { libraryId, apiKey, cdnHost }
}

function requireConfig() {
  const config = getBunnyStreamConfig()
  if (!config) throw new BunnyStreamError('Bunny Stream not configured', 503, 'BUNNY_STREAM_NOT_CONFIGURED')
  return config
}

async function parseBunnyResponse(response, safeMessage, code) {
  const body = await response.json().catch(async () => ({ message: await response.text().catch(() => '') }))
  if (!response.ok) throw new BunnyStreamError(safeMessage, response.status, code)
  return body
}

export function buildPlaybackUrl(videoId, config = requireConfig()) {
  return `https://${config.cdnHost}/${videoId}/playlist.m3u8`
}

export function buildThumbnailUrl(videoId, config = requireConfig()) {
  return `https://${config.cdnHost}/${videoId}/thumbnail.jpg`
}

export function normalizeVideo(video, config = requireConfig()) {
  const videoId = video.guid || video.videoGuid || video.id || video.videoId
  const rawStatus = Number(video.status ?? video.encodeProgressStatus ?? video.Status ?? 0)
  const isPlayable = rawStatus === 3 || rawStatus === 4 || Boolean(video.availableResolutions)
  const failed = rawStatus === 5 || rawStatus === 8
  return {
    libraryId: String(video.videoLibraryId || video.libraryId || config.libraryId),
    videoId,
    title: video.title || '',
    encodingStatus: String(video.status ?? video.Status ?? rawStatus),
    uploadStatus: failed ? 'failed' : isPlayable ? 'ready' : 'processing',
    isPlayable: !failed && isPlayable,
    playbackUrl: !failed && isPlayable ? buildPlaybackUrl(videoId, config) : null,
    thumbnailUrl: videoId ? buildThumbnailUrl(videoId, config) : null,
    failureMessage: failed ? 'Bunny processing failed' : null,
  }
}

export async function createBunnyVideo({ title }) {
  const config = requireConfig()
  const response = await fetch(`${API_BASE}/library/${config.libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: config.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  const body = await parseBunnyResponse(response, 'Bunny video creation failed', 'BUNNY_VIDEO_CREATION_FAILED')
  const normalized = normalizeVideo(body, config)
  if (!normalized.videoId) throw new BunnyStreamError('Bunny upload initialization failed', 502, 'BUNNY_UPLOAD_INITIALIZATION_FAILED')
  return normalized
}

export function createTusUploadCredentials(videoId, expiresInSeconds = 24 * 60 * 60) {
  const config = requireConfig()
  const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds
  const signature = createHash('sha256').update(`${config.libraryId}${config.apiKey}${expirationTime}${videoId}`).digest('hex')
  return { endpoint: TUS_ENDPOINT, libraryId: String(config.libraryId), videoId, expirationTime, signature }
}

export async function getBunnyVideo(videoId) {
  const config = requireConfig()
  const response = await fetch(`${API_BASE}/library/${config.libraryId}/videos/${videoId}`, {
    headers: { AccessKey: config.apiKey, Accept: 'application/json' },
  })
  const body = await parseBunnyResponse(response, 'Bunny status lookup failed', 'BUNNY_STATUS_LOOKUP_FAILED')
  return normalizeVideo(body, config)
}

export async function deleteBunnyVideo(videoId) {
  const config = requireConfig()
  const response = await fetch(`${API_BASE}/library/${config.libraryId}/videos/${videoId}`, {
    method: 'DELETE',
    headers: { AccessKey: config.apiKey, Accept: 'application/json' },
  })
  if (response.status === 404) return { deleted: true }
  await parseBunnyResponse(response, 'Bunny delete failed', 'BUNNY_DELETE_FAILED')
  return { deleted: true }
}
