import { useEffect, useRef, useState } from 'react'
import { createContent, getProfile } from '../lib/contentApi'
import { uploadVideoToBackblaze } from '../lib/backblazeUpload'
import { uploadVideoToCloudinary } from '../lib/cloudinaryUpload'
import { useAuth } from '../context/useAuth'

export default function UploadPage() {
  const { user } = useAuth()
  const formRef = useRef(null)
  const submitLockRef = useRef(false)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [username, setUsername] = useState(user?.user_metadata?.username || '')
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const uploadAbortRef = useRef(null)

  useEffect(() => {
    let active = true

    if (user?.id) {
      async function loadProfile() {
        const profile = await getProfile(user.id)
        if (!active) return
        setVerificationStatus(profile?.verification_status || null)
        if (profile?.username) setUsername(profile.username)
        setProfileLoading(false)
      }
      loadProfile()
    } else {
      setProfileLoading(false)
    }

    return () => {
      active = false
    }
  }, [user?.id])

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitLockRef.current) return
    submitLockRef.current = true

    const form = formRef.current || event.currentTarget
    const formData = new FormData(form)
    let mediaUrl = String(formData.get('media_url') || '').trim()
    const videoFile = formData.get('video_file')
    const captionUrl = String(formData.get('caption_url') || '').trim()
    const thumbnailUrl = String(formData.get('thumbnail_url') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const category = String(formData.get('category') || 'General').trim()
    const contentType = String(formData.get('content_type') || 'video').trim()
    const points = Number(formData.get('points')) || 20

    const hasLocalFile = videoFile && videoFile.size > 0

    if (!hasLocalFile && !mediaUrl) {
      setStatus('Choose a video file or paste a direct MP4 link.')
      submitLockRef.current = false
      return
    }

    if (!hasLocalFile && mediaUrl && !mediaUrl.toLowerCase().endsWith('.mp4')) {
      setStatus('Backup links must be direct .mp4 URLs.')
      submitLockRef.current = false
      return
    }

    if (captionUrl && !captionUrl.toLowerCase().endsWith('.vtt')) {
      setStatus('Only .vtt caption files are supported.')
      submitLockRef.current = false
      return
    }

    setSubmitting(true)
    setStatus(hasLocalFile ? 'Preparing upload…' : 'Publishing video…')

    try {
      if (!user?.id) {
        throw new Error('Sign in before publishing a video.')
      }

      if (!username) {
        throw new Error('Set a username in Profile before publishing.')
      }

      let storageProvider = 'external'
      let storageKey = null
      let cloudinaryPublicId = null

      if (hasLocalFile) {
        const controller = new AbortController()
        uploadAbortRef.current = controller
        try {
          const uploadResult = await uploadVideoToBackblaze(videoFile, {
            signal: controller.signal,
            onProgress: (progress) => setStatus(`Uploading to Backblaze: ${progress}%`),
          })
          mediaUrl = uploadResult.mediaUrl
          storageProvider = uploadResult.provider
          storageKey = uploadResult.storageKey
          cloudinaryPublicId = uploadResult.cloudinaryPublicId
        } catch (backblazeError) {
          if (backblazeError?.name === 'AbortError') throw backblazeError
          console.warn('Backblaze direct upload failed; trying backup storage.', backblazeError)
          setStatus('Backblaze upload failed. Trying backup storage…')
          const uploadResult = await uploadVideoToCloudinary(videoFile, {
            signal: controller.signal,
            onProgress: (progress) => setStatus(`Uploading to backup storage: ${progress}%`),
          })
          mediaUrl = uploadResult.mediaUrl
          storageProvider = uploadResult.provider
          storageKey = uploadResult.storageKey
          cloudinaryPublicId = uploadResult.cloudinaryPublicId
        } finally {
          uploadAbortRef.current = null
        }
        setStatus('Publishing video…')
      }

      await createContent({
        user_id: user.id,
        title,
        description,
        username,
        type: contentType,
        media_url: mediaUrl,
        caption_url: captionUrl || null,
        thumbnail_url: thumbnailUrl || null,
        storage_provider: storageProvider,
        storage_key: storageKey,
        cloudinary_public_id: cloudinaryPublicId,
        category,
        points,
        recommended: false,
        is_trending: false,
      })

      form?.reset()
      setSelectedFileName('')
      setStatus('Video published!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your video could not be published.'
      console.error('Publish failed:', err)
      setStatus(mediaUrl && hasLocalFile ? `${message} Upload completed, but publication failed; please do not re-upload unless needed.` : message)
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
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
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:p-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#102132] via-[#121212] to-[#07131b] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator Studio</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">Upload to SimpliChill</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">Share a video, tutorial, creator story, or slim with the SimpliChill community.</p>
          </div>
          <p className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-bold text-white/80">@{username || 'set-username-in-profile'}</p>
        </div>
      </section>

      <form ref={formRef} className="theme-card grid gap-4 rounded-[1.5rem] border p-4 shadow-xl shadow-black/10 sm:gap-5 sm:p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Video title
            <input className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="title" placeholder="Give your video a clear title" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Description
            <textarea className="theme-input min-h-28 rounded-2xl border px-4 py-3" name="description" placeholder="Tell viewers what they will see" required />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold">
            Format
            <select className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="content_type" defaultValue="video" aria-label="Post format">
              <option value="video">Regular video</option>
              <option value="short">Slim / short</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Category
            <select className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="category" defaultValue="General"><option>General</option><option>Tutorial</option><option>Coding</option><option>Shorts</option></select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Points
            <input className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="points" type="number" min="5" defaultValue="20" />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold">
          Video file
          <input
            accept="video/*"
            className="theme-input min-h-12 rounded-2xl border px-4 py-3 file:mr-3 file:rounded-full file:border-0 file:bg-[#3ea6ff] file:px-4 file:py-2 file:font-black file:text-[#06131c]"
            name="video_file"
            type="file"
            onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || '')}
          />
          <span className="text-xs font-normal theme-muted">{selectedFileName ? `Selected: ${selectedFileName}. Local files upload to Backblaze first, then backup storage only if needed.` : 'Choose a local video to upload directly to Backblaze B2. Cloudinary is automatic backup only.'}</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Thumbnail URL
            <input className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="thumbnail_url" placeholder="Optional image URL" type="url" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Direct MP4 link
            <input className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="media_url" placeholder="Direct MP4 URL" type="url" />
          </label>
        </div>

        <p className="text-xs theme-muted">If you select a local file and paste a direct MP4 URL, SimpliChill will publish the local file and ignore the URL.</p>

        <label className="grid gap-2 text-sm font-semibold">
          Captions
          <input className="theme-input min-h-12 rounded-2xl border px-4 py-3" name="caption_url" placeholder="Optional .vtt caption URL" type="url" />
        </label>

        <div className="sticky bottom-2 z-10 -mx-1 rounded-3xl border border-white/10 bg-black/70 p-2 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button className="w-full rounded-full bg-[#3ea6ff] px-5 py-3.5 font-black text-[#06131c] transition hover:bg-[#70bdff] disabled:opacity-60" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish video'}
            </button>
            {submitting && (
              <button className="rounded-full border border-white/15 px-5 py-3.5 font-black text-white transition hover:bg-white/10" type="button" onClick={() => uploadAbortRef.current?.abort()}>
                Cancel upload
              </button>
            )}
          </div>
        </div>
        {status && <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm theme-muted" role="status">{status}</p>}
      </form>
    </div>
  )
}
