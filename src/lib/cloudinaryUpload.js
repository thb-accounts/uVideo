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

export async function uploadThumbnailToCloudinary(file) {
  const formData = new FormData()
  formData.append('thumbnail', file)

  const { thumbnailUrl } = await apiRequest('/cloudinary/upload-thumbnail', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })

  return thumbnailUrl
}
