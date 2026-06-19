import { useState } from 'react'
import { completeVideoUpload, requestVideoUpload } from '../lib/contentApi'

export default function UploadPage() {
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  async function uploadToS3(uploadUrl, file) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('S3 upload failed')))
      xhr.onerror = () => reject(new Error('Network error while uploading video'))
      xhr.send(file)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('video_file')
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()

    if (!(file instanceof File) || !file.size) return setStatus('Choose a video file to upload.')
    if (!file.type.startsWith('video/')) return setStatus('Only video files are supported.')

    setSubmitting(true)
    setProgress(0)
    setStatus('Requesting secure upload URL...')
    try {
      const { video, upload } = await requestVideoUpload({ title, description, fileName: file.name, contentType: file.type })
      setStatus('Uploading directly to UVideo storage...')
      await uploadToS3(upload.uploadUrl, file)
      await completeVideoUpload(video.id)
      form.reset()
      setStatus('Upload complete. Your video is awaiting moderator review before public playback.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator Studio</p><h1 className="mt-2 text-3xl font-black">Upload to UVideo</h1></div>
    <p className="theme-muted">Select a video, upload it securely, and it will enter moderation before it appears publicly through CloudFront.</p>
    <form className="theme-card grid gap-4 rounded-2xl border p-5 sm:p-6" onSubmit={handleSubmit}>
      <input className="theme-input rounded-xl border px-3 py-2" name="title" placeholder="Video title" required maxLength="120" />
      <textarea className="theme-input rounded-xl border px-3 py-2" name="description" placeholder="Description" maxLength="1000" />
      <input className="theme-input rounded-xl border px-3 py-2" name="video_file" type="file" accept="video/*" required />
      {submitting && <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#3ea6ff] transition-all" style={{ width: `${progress}%` }} /></div>}
      <button className="rounded-full bg-[#3ea6ff] px-5 py-2.5 font-black text-[#06131c] transition hover:bg-[#70bdff] disabled:opacity-60" disabled={submitting}>{submitting ? `Uploading ${progress}%` : 'Upload for review'}</button>
      {status && <p className="text-sm theme-muted">{status}</p>}
    </form>
  </div>
}
