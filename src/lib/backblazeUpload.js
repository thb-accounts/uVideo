import { appConfig } from '../config/appConfig'
import { supabase } from './supabase'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function uploadFileWithProgress({ url, token, file, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let body = {}
      try {
        body = JSON.parse(xhr.responseText || '{}')
      } catch {
        body = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body)
      else reject(new Error(body.message || `Backblaze upload failed with status ${xhr.status}.`))
    }
    xhr.onerror = () => reject(new Error('Backblaze upload failed because of a network or CORS error.'))
    xhr.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'))

    if (signal) {
      if (signal.aborted) xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    const formData = new FormData()
    formData.append('video', file)
    xhr.send(formData)
  })
}

export async function uploadVideoToBackblaze(file, { signal, onProgress } = {}) {
  const token = await getAccessToken()
  const uploadResult = await uploadFileWithProgress({
    url: `${appConfig.apiBaseUrl}/backblaze/upload`,
    token,
    file,
    signal,
    onProgress,
  })

  return {
    provider: 'backblaze',
    mediaUrl: uploadResult.mediaUrl,
    storageKey: uploadResult.storageKey || uploadResult.fileName,
    cloudinaryPublicId: null,
  }
}
