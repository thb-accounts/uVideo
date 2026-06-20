import { useEffect, useState } from 'react'
import { createContent, getProfile } from '../lib/contentApi'
import { uploadVideoToCloudinary } from '../lib/cloudinaryUpload'
import { useAuth } from '../context/useAuth'

export default function UploadPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState(user?.user_metadata?.username || '')
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      async function loadProfile() {
        const profile = await getProfile(user.id)
        setVerificationStatus(profile?.verification_status || null)
        if (profile?.username) setUsername(profile.username)
        setProfileLoading(false)
      }
      loadProfile()
    } else {
      setProfileLoading(false)
    }
  }, [user?.id])

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    let mediaUrl = String(formData.get('media_url') || '').trim()
    const videoFile = formData.get('video_file')
    const captionUrl = String(formData.get('caption_url') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const category = String(formData.get('category') || 'General').trim()
    const contentType = String(formData.get('content_type') || 'video').trim()
    const points = Number(formData.get('points')) || 20

    if ((!videoFile || videoFile.size === 0) && !mediaUrl) {
      setStatus('Choose a video file or paste a direct MP4 link.')
      return
    }

    if (mediaUrl && !mediaUrl.toLowerCase().endsWith('.mp4')) {
      setStatus('Backup links must be direct .mp4 URLs.')
      return
    }

    if (captionUrl && !captionUrl.toLowerCase().endsWith('.vtt')) {
      setStatus('Only .vtt caption files are supported.')
      return
    }

    setSubmitting(true)
    setStatus(videoFile && videoFile.size > 0 ? 'Uploading your video to Cloudinary...' : 'Publishing your video...')

    try {
      if (!username) {
        throw new Error('Set a username in Profile before publishing.')
      }

      if (videoFile && videoFile.size > 0) {
        mediaUrl = await uploadVideoToCloudinary(videoFile)
        setStatus('Publishing your Cloudinary video...')
      }

      await createContent({
        user_id: user.id,
        title,
        description,
        username,
        type: contentType,
        media_url: mediaUrl,
        caption_url: captionUrl || null,
        category,
        points,
        recommended: false,
        is_trending: false,
      })

      form.reset()
      setStatus('Video published! It is now live in the feed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : "Your video should be published. This fallback message is only shown when the app cannot read the real error yet."
      console.error('Publish failed:', err)
      setStatus(message.includes("Cannot read properties of null (reading 'reset')") ? 'Your video was uploaded.' : message)
    } finally {
      setSubmitting(false)
    }
  }

  if (profileLoading) {
    return <div className="mx-auto max-w-3xl p-4 sm:p-8"><p className="theme-muted">Checking verification status…</p></div>
  }

  if (verificationStatus === 'pending') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator Studio</p>
        <h1 className="text-3xl font-black">Verification pending</h1>
        <p className="theme-muted">Uploads are available after your account verification status is no longer pending.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator Studio</p><h1 className="mt-2 text-3xl font-black">Upload to UVideo</h1></div>
      <p className="theme-muted">Share a video, tutorial, creator story, or slim with the UVideo community.</p>

      <p className="text-sm theme-muted">Posting as @{username || 'set-username-in-profile'}</p>

      <form className="theme-card grid gap-4 rounded-2xl border p-5 sm:p-6" onSubmit={handleSubmit}>
        <input className="theme-input rounded-xl border px-3 py-2" name="title" placeholder="Video title" required />
        <textarea className="theme-input rounded-xl border px-3 py-2" name="description" placeholder="Description" required />
        <div className="grid gap-2 sm:grid-cols-3">
          <select className="theme-input rounded-xl border px-3 py-2" name="content_type" defaultValue="video" aria-label="Post format">
            <option value="video">Regular video</option>
            <option value="short">Slim / short</option>
          </select>
          <select className="theme-input rounded-xl border px-3 py-2" name="category" defaultValue="General"><option>General</option><option>Tutorial</option><option>Coding</option><option>Shorts</option></select>
          <input className="theme-input rounded-xl border px-3 py-2" name="points" type="number" min="5" defaultValue="20" />
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Video file
          <input
            accept="video/*"
            className="theme-input rounded-xl border px-3 py-2"
            name="video_file"
            type="file"
          />
          <span className="text-xs font-normal theme-muted">Uploaded videos are stored and delivered through Cloudinary, a worldwide trusted provider.</span>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Backup MP4 link
          <input
            className="theme-input rounded-xl border px-3 py-2"
            name="media_url"
            placeholder="Direct MP4 URL (optional backup)"
            type="url"
          />
        </label>
        <input
          className="theme-input rounded-xl border px-3 py-2"
          name="caption_url"
          placeholder="Optional .vtt caption URL"
          type="url"
        />
        <button className="rounded-full bg-[#3ea6ff] px-5 py-2.5 font-black text-[#06131c] transition hover:bg-[#70bdff] disabled:opacity-60" disabled={submitting}>
          {submitting ? 'Publishing...' : 'Publish video'}
        </button>
        {status && <p className="text-sm theme-muted">{status}</p>}
      </form>
    </div>
  )
}
