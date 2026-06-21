import { apiRequest } from './apiClient'

export async function uploadVideoToCloudinary(file) {
  const formData = new FormData()
  formData.append('video', file)

  const { mediaUrl } = await apiRequest('/cloudinary/upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })

  return mediaUrl
}
