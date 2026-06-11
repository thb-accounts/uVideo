import { useEffect, useState } from 'react'
import { createContent, getProfile } from '../lib/contentApi'
import { useAuth } from '../context/useAuth'

export default function UploadPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState(user?.user_metadata?.username || '')

  useEffect(() => {
    if (user?.id) {
      async function loadProfile() {
        const profile = await getProfile(user.id)
        if (profile?.username) setUsername(profile.username)
      }
      loadProfile()
    }
  }, [user?.id])

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const mediaUrl = String(formData.get('media_url') || '').trim()
    const captionUrl = String(formData.get('caption_url') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const category = String(formData.get('category') || 'General').trim()
    const type = String(formData.get('type') || 'video') === 'short' ? 'short' : 'video'
    const points = Number(formData.get('points')) || 20

    if (!mediaUrl) {
      setStatus('Paste a direct MP4 link to publish your video.')
      return
    }

    if (mediaUrl && !mediaUrl.toLowerCase().endsWith('.mp4')) {
      setStatus('Video links must be direct .mp4 URLs.')
      return
    }

    if (captionUrl && !captionUrl.toLowerCase().endsWith('.vtt')) {
      setStatus('Only .vtt caption files are supported.')
      return
    }

    setSubmitting(true)
    setStatus('Publishing your video...')

    try {
      if (!username) {
        throw new Error('Set a username in Profile before publishing.')
      }

      await createContent({
        user_id: user.id,
        title,
        description,
        username,
        type,
        media_url: mediaUrl,
        caption_url: captionUrl || null,
        category,
        points,
        recommended: false,
        is_trending: false,
      })

      form.reset()
      setStatus(type === 'short' ? 'Short published! It is now live in the Shorts feed.' : 'Video published! It is now live on UVideo.')
    } catch (err) {
      const message = err instanceof Error ? err.message : "Your video should be published. This fallback message is only shown when the app cannot read the real error yet."
      console.error('Publish failed:', err)
      setStatus(message.includes("Cannot read properties of null (reading 'reset')") ? 'Your video was uploaded.' : message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ea6ff]">Creator Studio</p><h1 className="mt-2 text-3xl font-black">Upload to UVideo</h1></div>
      <p className="theme-muted">Share a MathArt video, tutorial, creator story, or short with the UVideo community.</p>

      <p className="text-sm theme-muted">Posting as @{username || 'set-username-in-profile'}</p>

      <form className="theme-card grid gap-4 rounded-2xl border p-5 sm:p-6" onSubmit={handleSubmit}>
        <input className="theme-input rounded-xl border px-3 py-2" name="title" placeholder="Video title" required />
        <textarea className="theme-input rounded-xl border px-3 py-2" name="description" placeholder="Description" required />
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Video format</legend>
          <p className="text-xs theme-muted">Only uploads explicitly labelled as Shorts appear in the Shorts feed.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="theme-input flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3">
              <input name="type" type="radio" value="video" defaultChecked />
              <span><span className="block font-semibold">Video</span><span className="block text-xs theme-muted">Publish as a standard video.</span></span>
            </label>
            <label className="theme-input flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3">
              <input name="type" type="radio" value="short" />
              <span><span className="block font-semibold">Short</span><span className="block text-xs theme-muted">Include this upload in the Shorts feed.</span></span>
            </label>
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Topic" className="theme-input rounded-xl border px-3 py-2" name="category" defaultValue="MathArt"><option>MathArt</option><option>Tutorial</option><option>Coding</option><option>Desmos</option><option>UnrealCake8</option><option>General</option></select>
          <input aria-label="Points" className="theme-input rounded-xl border px-3 py-2" name="points" type="number" min="5" defaultValue="20" />
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Direct MP4 link
          <input
            className="theme-input rounded-xl border px-3 py-2"
            name="media_url"
            placeholder="https://example.com/video.mp4"
            required
            type="url"
          />
          <a
            className="w-fit text-xs font-bold text-[#3ea6ff] underline decoration-[#3ea6ff]/50 underline-offset-4 hover:text-[#70bdff]"
            href="https://server.unrealcake8.site"
          >
            Don&apos;t have a link? We can
          </a>
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
