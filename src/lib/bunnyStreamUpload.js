import * as tus from 'tus-js-client'
import { apiRequest } from './apiClient'
import { supabase } from './supabase'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

export async function deleteBunnyUpload(contentId) {
  const token = await getAccessToken()
  return apiRequest(`/bunny-stream/videos/${contentId}`, { method: 'DELETE', token })
}

function uploadTus(file, session, { signal, onProgress }) {
  let accepted = false
  let upload
  const promise = new Promise((resolve, reject) => {
    upload = new tus.Upload(file, {
      endpoint: session.upload.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: session.upload.signature,
        AuthorizationExpire: String(session.upload.expirationTime),
        VideoId: session.upload.videoId,
        LibraryId: session.upload.libraryId,
      },
      metadata: { filetype: session.metadata.filetype || file.type, title: session.metadata.title || file.name },
      onProgress(bytesUploaded, bytesTotal) {
        if (bytesUploaded > 0) accepted = true
        if (bytesTotal && onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100))
      },
      onSuccess() { resolve({ accepted: true }) },
      onError(error) {
        if (signal?.aborted) reject(new DOMException('Upload canceled.', 'AbortError'))
        else reject(Object.assign(error, { bunnyAccepted: accepted }))
      },
    })
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    }).catch(reject)
  })
  if (signal) signal.addEventListener('abort', () => upload?.abort(true), { once: true })
  return promise
}

export async function uploadVideoToBunnyStream(file, metadata, { signal, onProgress, onStatus } = {}) {
  const token = await getAccessToken()
  onStatus?.('Preparing Bunny Stream upload…')
  const session = await apiRequest('/bunny-stream/uploads', {
    method: 'POST',
    token,
    body: { ...metadata, fileName: file.name, contentType: file.type, fileSize: file.size },
  })
  try {
    await uploadTus(file, session, { signal, onProgress })
  } catch (error) {
    if (error?.name === 'AbortError') await deleteBunnyUpload(session.contentId).catch(() => {})
    error.contentId = session.contentId
    throw error
  }
  onStatus?.('Video uploaded. Bunny Stream is processing it…')
  const complete = await apiRequest(`/bunny-stream/uploads/${session.contentId}/complete`, { method: 'POST', token })
  let latest = complete
  for (let attempt = 0; attempt < 30 && latest.uploadStatus === 'processing'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt < 5 ? 3000 : 10000))
    latest = await apiRequest(`/bunny-stream/videos/${session.contentId}/status`, { token })
    if (latest.uploadStatus === 'ready') break
    if (latest.uploadStatus === 'failed') throw new Error(latest.failureMessage || 'Video processing failed. Please retry the upload.')
  }
  return { provider: 'bunny_stream', contentId: session.contentId, content: complete.content, status: latest }
}
