import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import {
  likeContent,
  unlikeContent,
  fetchLikeStatus,
  fetchLikeCount,
  fetchComments,
  addComment,
  deleteComment,
  deleteContent,
  createReport,
  fetchFollowStatus,
  followUser,
  unfollowUser,
  fetchFollowerCount,
} from '../lib/contentApi'
import { readUiSettings } from '../lib/uiSettings'
import { parseVTT, formatBionic } from '../lib/captionUtils'

// ─── Video / Embed Player ─────────────────────────────────────────────────────
function FeedPlayer({ item, isActive, isPaused, settings }) {
  const videoRef = useRef(null)
  const [cues, setCues] = useState([])
  const [currentCaption, setCurrentCaption] = useState('')
  const [isMuted, setIsMuted] = useState(settings.mutedByDefault)
  const mediaUrl = item?.media_url
  const captionUrl = item?.captionUrl || item?.caption_url

  useEffect(() => {
    if (!videoRef.current) return
    if (isActive && !isPaused) {
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
    }
  }, [isActive, isPaused])

  useEffect(() => {
    if (captionUrl) {
      fetch(captionUrl)
        .then(res => res.text())
        .then(text => setCues(parseVTT(text)))
        .catch(err => console.error('Failed to load captions:', err))
    } else {
      setCues([])
    }
  }, [captionUrl])

  function handleTimeUpdate() {
    if (!videoRef.current || cues.length === 0) return

    const time = videoRef.current.currentTime
    const activeCue = cues.find(c => time >= c.start && time <= c.end)
    if (activeCue) {
      const formatted = settings.bionicReading ? formatBionic(activeCue.text) : activeCue.text
      if (formatted !== currentCaption) {
        setCurrentCaption(formatted)
      }
    } else if (currentCaption !== '') {
      setCurrentCaption('')
    }
  }

  if (!item) return null

  const isYoutube =
    mediaUrl?.includes('youtube.com') || mediaUrl?.includes('youtu.be')

  if (item.type === 'mini') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[var(--brand-olive)] to-[var(--brand-black)] text-white">
        <div className="text-6xl mb-4">🎮</div>
        <p className="text-2xl font-bold">Mini Experience</p>
        <p className="mt-2 max-w-xs text-center text-white/70 text-base">
          Tap Open to play and earn points
        </p>
      </div>
    )
  }

  if (isYoutube) {
    const embedUrl = mediaUrl
      .replace('watch?v=', 'embed/')
      .replace('youtu.be/', 'youtube.com/embed/')
    const src = isActive && !isPaused
      ? `${embedUrl}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${embedUrl.split('/').pop()}`
      : embedUrl
    return (
      <div className="relative h-full w-full">
        <iframe
          key={isActive && !isPaused ? 'active' : 'inactive'}
          title={item.title}
          src={src}
          className="h-full w-full pointer-events-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {isMuted && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(false); }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 px-6 text-center text-base font-bold text-white"
          >
            🔊 Enable Sound
          </button>
        )}
      </div>
    )
  }

  if (mediaUrl) {
    return (
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          src={mediaUrl}
          className="h-full w-full object-cover"
          loop
          playsInline
          muted={isMuted}
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Custom Caption Overlay */}
        {currentCaption && (
          <div className="absolute bottom-24 left-0 right-0 px-6 pointer-events-none z-20">
            <div className="mx-auto max-w-xs text-center">
              <span
                className="inline-block bg-black/60 px-3 py-1.5 rounded-lg text-white text-base leading-snug shadow-xl backdrop-blur-sm border border-white/10"
                dangerouslySetInnerHTML={{ __html: currentCaption }}
              />
            </div>
          </div>
        )}

        {isMuted && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(false); }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 px-6 text-center text-base font-bold text-white"
          >
            🔊 Enable Sound/Captions
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black text-white px-8 text-center">
      <div className="text-5xl mb-4">📚</div>
      <p className="text-xl font-bold">{item.title}</p>
      <p className="mt-2 text-white/60 text-sm">{item.description}</p>
    </div>
  )
}

// ─── Comments Drawer ──────────────────────────────────────────────────────────
function CommentsDrawer({ item, onClose, onCommentAdded, onCommentDeleted, onReportComment }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [reportingComment, setReportingComment] = useState(null)
  const [reportReason, setReportReason] = useState('spam')
  const [reportDetails, setReportDetails] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchComments(item.id).then((data) => {
      setComments(data)
      setLoading(false)
    })
  }, [item.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function handlePost(e) {
    e.preventDefault()
    if (!body.trim() || !user) return
    setPosting(true)
    try {
      const newComment = await addComment({
        userId: user.id,
        contentId: item.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'anon',
        body: body.trim(),
      })
      setComments((prev) => [...prev, newComment])
      setBody('')
      onCommentAdded?.()
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteComment(commentId) {
    await deleteComment(commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    onCommentDeleted?.()
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      {/* Drawer panel */}
      <div
        className="w-full max-w-lg rounded-t-2xl bg-[#1a1a1a] flex flex-col"
        style={{ height: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <p className="text-white font-semibold text-base">
            {loading ? '...' : `${comments.length} comments`}
          </p>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && (
            <p className="text-white/40 text-sm text-center mt-8">Loading comments…</p>
          )}
          {!loading && comments.length === 0 && (
            <p className="text-white/40 text-sm text-center mt-8">
              No comments yet. Be the first!
            </p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 items-start">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-[var(--brand-olive)] to-[var(--brand-sage)] flex items-center justify-center text-white text-xs font-bold">
                {(c.user_handle || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs font-semibold mb-0.5">@{c.user_handle}</p>
                <p className="text-white text-sm leading-snug break-words">{c.body}</p>
                <p className="text-white/30 text-xs mt-1">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setReportingComment(c)} className="text-white/30 hover:text-yellow-400 text-xs flex-shrink-0 mt-1">Report</button>
              {user?.id === c.user_id && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="text-white/30 hover:text-red-400 text-xs flex-shrink-0 mt-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handlePost}
          className="flex gap-2 px-4 py-3 border-t border-white/10"
        >
          {user ? (
            <>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-white text-sm placeholder-white/30 outline-none focus:bg-white/15"
              />
              <button
                type="submit"
                disabled={posting || !body.trim()}
                className="rounded-full bg-[var(--brand-olive)] px-4 py-2 text-white text-sm font-semibold disabled:opacity-40"
              >
                Post
              </button>
            </>
          ) : (
            <p className="text-white/40 text-sm w-full text-center py-1">
              <Link to="/auth" className="text-[var(--brand-sage)] underline">Log in</Link> to comment
            </p>
          )}
        </form>
      {reportingComment && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4" onClick={() => setReportingComment(null)}>
          <div className="w-full max-w-sm rounded-xl bg-[#111] border border-white/20 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-white">Report comment by @{reportingComment.user_handle}</p>
            <select value={reportReason} onChange={(e)=>setReportReason(e.target.value)} className="mt-3 w-full rounded bg-white/10 px-2 py-2 text-sm text-white">
              <option value="harassment">harassment</option><option value="hate">hate</option><option value="sexual content">sexual content</option><option value="violence">violence</option><option value="spam">spam</option><option value="misinformation">misinformation</option><option value="copyright">copyright</option><option value="other">other</option>
            </select>
            <textarea value={reportDetails} onChange={(e)=>setReportDetails(e.target.value)} placeholder="Optional details" className="mt-2 w-full rounded bg-white/10 px-2 py-2 text-sm text-white"/>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 rounded border border-white/30 py-2 text-sm" onClick={() => setReportingComment(null)}>Cancel</button>
              <button className="flex-1 rounded bg-[var(--brand-olive)] py-2 text-sm font-semibold" onClick={async () => { await onReportComment?.(reportingComment.id, reportingComment.user_id, reportReason, reportDetails); setReportingComment(null); setReportDetails('') }}>Submit report</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, loading }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl p-6 w-80 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-lg mb-2">Delete this video?</p>
        <p className="text-white/50 text-sm mb-5">
          This can't be undone. The video will be removed from the feed permanently.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/20 py-2 text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full bg-red-500 py-2 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main FeedItem ────────────────────────────────────────────────────────────
export default function FeedItem({ item, isActive, onDeleted }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(item?.like_count ?? 0)
  const [commentCount, setCommentCount] = useState(item?.comment_count ?? 0)
  const [showComments, setShowComments] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [settings] = useState(readUiSettings())

  const isOwner = user && item?.user_id && user.id === item.user_id

  // Reset pause state when becoming active/inactive
  useEffect(() => {
    setIsPaused(false)
  }, [isActive])

  // Fetch real like status and counts on mount
  useEffect(() => {
    if (!item?.id) return
    if (user?.id) {
      fetchLikeStatus(user.id, item.id).then(setLiked)
    }
  }, [user?.id, item?.id])

  // Sync counts on mount or when item changes
  useEffect(() => {
    if (!item?.id) return
    fetchLikeCount(item.id).then((count) => setLikeCount(count))
    fetchComments(item.id).then((comments) => setCommentCount(comments.length))
  }, [item?.id])

  useEffect(() => {
    if (!item?.user_id) return
    fetchFollowerCount(item.user_id).then(setFollowersCount).catch(() => {})
    if (user?.id && user.id !== item.user_id) {
      fetchFollowStatus(user.id, item.user_id).then(setIsFollowing).catch(() => {})
    } else {
      setIsFollowing(false)
    }
  }, [item?.user_id, user?.id])

  async function handleLike() {
    if (!user) {
      navigate('/auth')
      return
    }
    const nowLiked = !liked
    setLiked(nowLiked)
    setLikeCount((prev) => (nowLiked ? prev + 1 : Math.max(prev - 1, 0)))
    if (nowLiked) await likeContent(user.id, item.id)
    else await unlikeContent(user.id, item.id)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteContent(item.id)
      setShowDeleteModal(false)
      onDeleted?.(item.id)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/video/${item.id}`
    if (navigator.share) {
      navigator.share({ title: item.title, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
    }
  }


  async function handleReport(targetType, targetId, targetUserId = null, reason = 'spam', details = '', targetUserEmail = null) {
    if (!user) { navigate('/auth'); return }
    await createReport({ target_type: targetType, target_id: targetId, target_user_id: targetUserId, reporter_id: user.id, reporter_email: user.email || null, target_user_email: targetUserEmail, reason, details: details || null })
    alert('Report submitted')
  }

  async function handleFollowToggle() {
    if (!item?.user_id || isOwner) return
    if (!user) {
      navigate('/auth')
      return
    }
    const next = !isFollowing
    setIsFollowing(next)
    setFollowersCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)))
    try {
      if (next) await followUser(user.id, item.user_id)
      else await unfollowUser(user.id, item.user_id)
    } catch {
      setIsFollowing(!next)
      setFollowersCount((prev) => (!next ? prev + 1 : Math.max(0, prev - 1)))
    }
  }

  return (
    <>
      <div className="relative h-full w-full overflow-hidden bg-black">
        {/* Media */}
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
          onClick={() => setIsPaused(!isPaused)}
        >
          <div
            className="relative h-full w-full max-w-[56.25vh] overflow-hidden bg-black"
            style={{ aspectRatio: '9 / 16' }}
          >
            <FeedPlayer
              item={item}
              isActive={isActive}
              isPaused={isPaused}
              settings={settings}
            />
          </div>
          {isPaused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-30">
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-black/40 text-white text-3xl">
                ▶️
              </div>
            </div>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom-left: creator info + caption */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-20 z-30 p-4 pb-24 text-white lg:pb-8">
          <div className="pointer-events-auto">
            {item?.username && (
              <Link
                to={`/u/${item.username}`}
                className="mb-1 inline-flex max-w-full items-center gap-2 text-xl font-black hover:underline lg:text-base"
              >
                {item?.avatar_url ? (
                  <img
                    src={item.avatar_url}
                    alt={`${item.username} avatar`}
                    className="h-7 w-7 shrink-0 rounded-full border border-white/30 object-cover lg:h-8 lg:w-8"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-[var(--brand-olive)] to-[var(--brand-sage)] text-xs font-bold lg:h-8 lg:w-8">
                    {item.username[0].toUpperCase()}
                  </span>
                )}
                @{item.username}
              </Link>
            )}
            <p className="line-clamp-2 text-base font-semibold leading-snug drop-shadow-md lg:text-base">
              {item?.title}
            </p>
            {item?.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/80 simple-mode-hidden lg:text-sm lg:text-white/70">
                {item.description}
              </p>
            )}
            <div className="mt-2 hidden flex-wrap items-center gap-2 lg:flex">
              <span className="inline-block rounded-full bg-white/15 backdrop-blur px-2.5 py-0.5 text-xs capitalize">
                {item?.type}
              </span>
              <Link
                to={`/video/${item.id}`}
                className="inline-block rounded-full bg-[rgba(62,75,47,0.85)] backdrop-blur px-2.5 py-0.5 text-xs font-semibold hover:bg-[var(--brand-leaf)]"
              >
                View page ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Right action rail */}
        <div className="absolute bottom-24 right-3 z-30 flex flex-col items-center gap-4 pb-2 lg:bottom-8 lg:right-2 lg:gap-5">
          {/* Creator avatar + follow */}
          <div className="relative">
            <Link to={item?.username ? `/u/${item.username}` : '#'}>
              {item?.avatar_url ? (
                <img
                  src={item.avatar_url}
                  alt={`${item?.username || 'creator'} avatar`}
                  className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-lg lg:h-12 lg:w-12"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[var(--brand-olive)] to-[var(--brand-sage)] text-base font-bold text-white shadow-lg">
                  {(item?.username || '?')[0].toUpperCase()}
                </div>
              )}
            </Link>
            {!isOwner && (
              <button
                onClick={handleFollowToggle}
                className={`absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[0] font-bold after:text-2xl after:content-['+'] lg:-bottom-3 lg:text-[10px] lg:after:content-[''] ${
                  isFollowing
                    ? 'bg-white text-black border-white'
                    : 'bg-[var(--brand-olive)] text-white border-white'
                }`}
              >
                {isFollowing ? 'Subscribed' : 'Subscribe'}
              </button>
            )}
          </div>
          {item?.user_id && (
            <span className="hidden text-white text-[11px] font-semibold drop-shadow simple-mode-hidden -mt-3 lg:block">
              {followersCount} subscribers
            </span>
          )}

          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 group"
            aria-label="Like"
          >
            <span
              className={`text-4xl leading-none transition-transform duration-150 lg:text-3xl ${liked ? 'scale-125' : 'group-active:scale-125'}`}
            >
              {liked ? '❤️' : '🤍'}
            </span>
            <span className="text-sm font-semibold text-white drop-shadow simple-mode-hidden lg:text-xs">{likeCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center gap-1"
            aria-label="Comments"
          >
            <span className="text-4xl leading-none lg:text-3xl">●</span>
            <span className="text-sm font-semibold text-white drop-shadow simple-mode-hidden lg:text-xs">{commentCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1"
            aria-label="Share"
          >
            <span className="text-4xl leading-none lg:text-3xl">↪</span>
            <span className="text-sm font-semibold text-white drop-shadow simple-mode-hidden lg:text-xs">Share</span>
          </button>

          {/* Delete (owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex flex-col items-center gap-1"
              aria-label="Delete"
            >
              <span className="text-3xl leading-none lg:text-2xl">🗑️</span>
              <span className="text-sm font-semibold text-white drop-shadow simple-mode-hidden lg:text-xs">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Comments drawer */}
      {showComments && (
        <CommentsDrawer
          item={{ ...item, comment_count: commentCount }}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((prev) => prev + 1)}
          onCommentDeleted={() => setCommentCount((prev) => Math.max(0, prev - 1))}
          onReportComment={(commentId, targetUserId, reason, details) => handleReport('comment', commentId, targetUserId, reason, details)}
        />
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </>
  )
}
