import { apiRequest } from './apiClient'
import { supabase } from './supabase'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function putFileWithProgress({ url, file, contentType, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Backblaze upload failed with status ${xhr.status}.`))
    }
    xhr.onerror = () => reject(new Error('Backblaze upload failed because of a network or CORS error.'))
    xhr.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'))

    if (signal) {
      if (signal.aborted) xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}

export async function uploadVideoToBackblaze(file, { signal, onProgress } = {}) {
  const token = await getAccessToken()
  const presign = await apiRequest('/backblaze/presign-upload', {
    method: 'POST',
    token,
    body: {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    },
  })

  await putFileWithProgress({
    url: presign.uploadUrl,
    file,
    contentType: file.type,
    signal,
    onProgress,
  })

  return {
    provider: 'backblaze',
    mediaUrl: presign.playbackUrl,
    storageKey: presign.storageKey,
    cloudinaryPublicId: null,
  }
}
