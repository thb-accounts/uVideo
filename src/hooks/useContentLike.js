import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { fetchLikeCount, fetchLikeStatus, likeContent, unlikeContent } from '../lib/contentApi'
import { useOnline } from '../lib/useOnline'

// One interaction model for the watch page and the Blinks feed.
export function useContentLike(contentId, initialCount = 0) {
  const { user } = useAuth()
  const online = useOnline()
  const navigate = useNavigate()
  const identity = `${contentId || ''}:${user?.id || ''}:${online}`
  const current = useRef(identity)
  current.current = identity
  const busy = useRef(false)
  const revision = useRef(0)
  const [state, setState] = useState({ identity: '', liked: false, count: initialCount, ready: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    busy.current = false
    setSaving(false)
    setError('')
    setState({ identity, liked: false, count: initialCount, ready: false })
    if (!contentId || !online) return
    Promise.all([fetchLikeCount(contentId), user?.id ? fetchLikeStatus(user.id, contentId) : false])
      .then(([count, liked]) => { if (!cancelled) setState({ identity, count, liked, ready: true }) })
      .catch(() => { if (!cancelled) setError('Likes could not load. Refresh to try again.') })
    return () => { cancelled = true }
  }, [contentId, user?.id, online, identity, initialCount])

  async function toggleLike() {
    if (!user) { navigate('/auth'); return }
    if (!online || !state.ready || state.identity !== identity || busy.current) return
    busy.current = true
    const writeRevision = ++revision.current
    setSaving(true)
    setError('')
    const before = state
    const liked = !before.liked
    setState({ ...before, liked, count: Math.max(0, before.count + (liked ? 1 : -1)) })
    try {
      if (liked) await likeContent(user.id, contentId)
      else await unlikeContent(user.id, contentId)
    } catch {
      if (current.current === identity) {
        setState(before)
        setError('Your like could not be saved. Please try again.')
      }
      return
    } finally {
      if (current.current === identity) { busy.current = false; setSaving(false) }
    }
    // A failed count refresh must never undo a successful write.
    fetchLikeCount(contentId).then(count => {
      if (current.current === identity && revision.current === writeRevision && !busy.current) setState(value => ({ ...value, count }))
    }).catch(() => {})
  }

  const matches = state.identity === identity
  return { liked: matches && state.liked, likeCount: matches ? state.count : initialCount,
    likeDisabled: !online || saving || (Boolean(user) && (!matches || !state.ready)),
    likeError: error, toggleLike }
}
