import { apiRequest } from './apiClient'
import { supabase } from './supabase'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function postFormDataWithProgress({ url, formData, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || '{}')
      if (xhr.status >= 200 && xhr.status < 300) resolve(body)
      else reject(new Error(body.error?.message || `Backup upload failed with status ${xhr.status}.`))
    }
    xhr.onerror = () => reject(new Error('Backup upload failed because of a network or CORS error.'))
    xhr.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'))

    if (signal) {
      if (signal.aborted) xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

export async function uploadVideoToCloudinary(file, { signal, onProgress } = {}) {
  const token = await getAccessToken()
  const signed = await apiRequest('/cloudinary/sign-upload', {
    method: 'POST',
    token,
    body: {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    },
  })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', signed.apiKey)
  formData.append('folder', signed.folder)
  formData.append('public_id', signed.publicId)
  formData.append('timestamp', String(signed.timestamp))
  formData.append('signature', signed.signature)

  const response = await postFormDataWithProgress({
    url: `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`,
    formData,
    signal,
    onProgress,
  })

  return {
    provider: 'cloudinary',
    mediaUrl: response.secure_url,
    storageKey: null,
    cloudinaryPublicId: response.public_id,
  }
}
