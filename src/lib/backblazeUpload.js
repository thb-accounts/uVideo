import { apiRequest } from './apiClient'

export async function uploadVideoToBackblaze(file) {
  const formData = new FormData()
  formData.append('video', file)

  const { mediaUrl } = await apiRequest('/backblaze/upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })

  return mediaUrl
}
