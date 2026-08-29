import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { bunnyEmbedUrl, isBunnyStreamContent } from '../lib/mediaUrls'
import {
  deleteContent,
  fetchContent,
  fetchContentById,
  fetchLikeStatus,
  getProfile,
  likeContent,
  unlikeContent,
} from '../lib/contentApi'
import { relativeDate } from '../lib/relativeDate'

function embedUrl(url = '') {
  return url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
}

function Player({ item }) {
  const isYoutube = item.media_url?.includes('youtube.com') || item.media_url?.includes('youtu.be')
  if (isYoutube) return <iframe title={item.title} src={`${embedUrl(item.media_url)}?rel=0`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
  if (isBunnyStreamContent(item)) return <iframe src={bunnyEmbedUrl(item)} className="h-full w-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={item.title || 'Video'} />
  if (item.media_url) return <video src={item.media_url} className="h-full w-full object-contain" controls playsInline preload="metadata" controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} />
  return <div className="grid h-full place-items-center bg-gradient-to-br from-[#e8f4ed] to-[#f5f7f5] text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl text-[#126341] shadow-sm">▶</div><p className="mt-4 font-bold text-[#142019]">Preview unavailable</p></div></div>
}

function Recommendation({ item }) {
  return <Link to={`/video/${item.id}`} className="group grid grid-cols-[168px_1fr] gap-3"><div className="aspect-video overflow-hidden rounded-xl border border-[var(--app-border)] bg-gradient-to-br from-[#e8f4ed] to-[#f5f7f5]">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-lg font-black text-[#126341]">▶</div>}</div><div className="min-w-0"><h3 className="line-clamp-2 text-sm font-bold leading-5 text-[var(--app-text)] group-hover:text-[var(--brand-primary)]">{item.title}</h3><p className="mt-1 truncate text-xs text-[var(--app-muted)]">@{item.username || 'mplace'}</p><p className="text-xs text-[var(--app-muted)]">{relativeDate(item.created_at)}</p></div></Link>
}

export default function VideoPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [avatarUrl, setAvatarUrl] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = Boolean(user?.id && item?.user_id === user.id)
  const recommendations = useMemo(() => catalog.filter((video) => video.id !== id).slice(0, 10), [catalog, id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchContentById(id), fetchContent()]).then(async ([content, contentData]) => {
      if (cancelled) return
      setItem(content)
      setCatalog(contentData || [])
      setLikeCount(content?.like_count || 0)
      if (content?.user_id) {
        const profile = await getProfile(content.user_id)
        if (!cancelled) setAvatarUrl(profile?.avatar_url || '')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => { if (user?.id && item) fetchLikeStatus(user.id, id).then(setLiked) }, [user?.id, item, id])

  async function handleLike() {
    if (!user) return navigate('/auth')
    const next = !liked
    setLiked(next)
    setLikeCount((count) => next ? count + 1 : Math.max(0, count - 1))
    if (next) await likeContent(user.id, id); else await unlikeContent(user.id, id)
  }

  async function handleDelete() {
    setDeleting(true)
    try { await deleteContent(id); navigate('/') } catch { setDeleting(false) }
  }

  function handleShare() {
    if (navigator.share) navigator.share({ title: item.title, url: window.location.href }).catch(() => {})
    else navigator.clipboard.writeText(window.location.href)
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--brand-primary)] border-t-transparent" /></div>
  if (!item) return <div className="grid min-h-[70vh] place-items-center text-center"><div><p className="text-xl font-bold">Video not found.</p><Link to="/" className="mt-3 inline-block text-[var(--brand-primary)]">Return home</Link></div></div>

  return (
    <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="min-w-0">
        <div className="aspect-video overflow-hidden rounded-[18px] bg-black shadow-sm"><Player item={item} /></div>
        <h1 className="mt-4 text-xl font-extrabold leading-tight tracking-[-0.02em] sm:text-2xl">{item.title}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-border)] pb-5">
          <Link to={item.username ? `/u/${item.username}` : '#'} className="flex min-w-0 items-center gap-3">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-[#126341] font-black text-white">{(item.username || 'M')[0].toUpperCase()}</span>}
            <span className="min-w-0"><strong className="block truncate text-sm">{item.username || 'MPlace creator'}</strong><small className="text-[var(--app-muted)]">View channel</small></span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleLike} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${liked ? 'bg-[#126341] text-white' : 'border border-[var(--app-border)] bg-white hover:bg-[#e8f4ed] hover:text-[#126341]'}`}>{liked ? '♥' : '♡'} {likeCount}</button>
            <button onClick={handleShare} className="min-h-11 rounded-xl border border-[var(--app-border)] bg-white px-4 text-sm font-bold hover:bg-[#e8f4ed] hover:text-[#126341]">Share</button>
            {isOwner && <button onClick={() => setShowDeleteModal(true)} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100">Delete</button>}
          </div>
        </div>
        <div className="theme-card mt-5 rounded-[18px] border p-4"><p className="text-sm font-bold">{[item.category || 'Video', relativeDate(item.created_at)].filter(Boolean).join(' · ')}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-muted)]">{item.description || 'A video shared on MPlace Videos.'}</p></div>
      </section>
      <aside className="space-y-4"><h2 className="text-lg font-extrabold tracking-[-0.02em]">Up next</h2>{recommendations.map((video) => <Recommendation key={video.id} item={video} />)}{recommendations.length === 0 && <p className="text-sm text-[var(--app-muted)]">More videos are on the way.</p>}</aside>
      {showDeleteModal && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#142019]/45 p-4" onClick={() => setShowDeleteModal(false)}><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 className="text-lg font-extrabold">Delete this video?</h2><p className="mt-2 text-sm text-[var(--app-muted)]">This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowDeleteModal(false)} className="rounded-xl px-4 py-2 text-sm font-bold">Cancel</button><button onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{deleting ? 'Deleting…' : 'Delete'}</button></div></div></div>}
    </div>
  )
}
