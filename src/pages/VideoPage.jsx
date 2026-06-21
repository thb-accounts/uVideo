import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import {
  deleteContent, fetchContent,
  fetchContentById, fetchLikeStatus, getProfile,
  likeContent, unlikeContent,
} from '../lib/contentApi'
import { relativeDate } from '../lib/relativeDate'

function embedUrl(url = '') {
  return url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
}

const protectedVideoProps = {
  controlsList: 'nodownload',
  disablePictureInPicture: true,
  onContextMenu: (event) => event.preventDefault(),
}

function Player({ item }) {
  const isYoutube = item.media_url?.includes('youtube.com') || item.media_url?.includes('youtu.be')
  if (isYoutube) return <iframe title={item.title} src={`${embedUrl(item.media_url)}?controls=1`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
  if (item.media_url) return <video src={item.media_url} className="h-full w-full bg-black object-contain" controls playsInline {...protectedVideoProps} />
  return <div className="grid h-full place-items-center bg-gradient-to-br from-[#102838] via-[#102a43] to-[#07191f] p-8 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#3ea6ff] text-2xl font-black text-[#06131c]">U</span><p className="mt-4 text-lg font-bold">{item.title}</p><p className="mt-2 text-sm text-[#aaa]">This creator preview is coming soon.</p></div></div>
}

function Recommendation({ item }) {
  return <Link to={`/video/${item.id}`} className="group grid grid-cols-[150px_1fr] gap-3"><div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#16324a] to-[#087ea4]"><div className="grid h-full place-items-center text-xl font-black text-white/80">U</div></div><div className="min-w-0"><h3 className="line-clamp-2 text-sm font-bold leading-5 group-hover:text-[#8ed0ff]">{item.title}</h3><p className="mt-1 truncate text-xs text-[#aaa]">@{item.username || 'uvideo'}</p><p className="text-xs text-[#777]">{relativeDate(item.created_at)}</p></div></Link>
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
  const recommendations = useMemo(() => catalog.filter((video) => video.id !== id).slice(0, 8), [catalog, id])

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

  useEffect(() => {
    if (!user?.id || !item) return
    fetchLikeStatus(user.id, id).then(setLiked)
  }, [user?.id, item, id])

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

  if (loading) return <div className="grid min-h-[70vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3ea6ff] border-t-transparent" /></div>
  if (!item) return <div className="grid min-h-[70vh] place-items-center text-center"><div><p className="text-xl font-bold">Video not found.</p><Link to="/" className="mt-3 inline-block text-[#3ea6ff]">Return home</Link></div></div>

  return (
    <div className="mx-auto grid max-w-[1500px] gap-8 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0">
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-2xl"><Player item={item} /></div>
        <h1 className="mt-4 text-xl font-black leading-tight sm:text-2xl">{item.title}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={item.username ? `/u/${item.username}` : '#'} className="flex min-w-0 items-center gap-3">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#3ea6ff] to-[#00c8ff] font-black text-[#06131c]">{(item.username || 'U')[0].toUpperCase()}</span>}
              <span className="min-w-0"><strong className="block truncate text-sm">{item.username || 'UVideo creator'}</strong><small className="text-[#888]">Creator channel</small></span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleLike} className={`rounded-full px-4 py-2 text-sm font-bold transition ${liked ? 'bg-[#3ea6ff] text-[#06131c]' : 'bg-[#272727] hover:bg-[#383838]'}`}>{liked ? '♥' : '♡'} {likeCount}</button>
            <button onClick={handleShare} className="rounded-full bg-[#272727] px-4 py-2 text-sm font-bold hover:bg-[#383838]">↗ Share</button>
            {isOwner && <button onClick={() => setShowDeleteModal(true)} className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/25">Delete</button>}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[#272727] p-4 text-sm">
          <p className="font-bold">{[item.category || 'Video', relativeDate(item.created_at)].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-[#ddd]">{item.description || 'A video from the UVideo creator community.'}</p>
        </div>

      </div>

      <aside className="space-y-4"><h2 className="text-lg font-black">Up next</h2>{recommendations.map((video) => <Recommendation key={video.id} item={video} />)}{recommendations.length === 0 && <p className="text-sm text-[#888]">More creator videos are on the way.</p>}</aside>

      {showDeleteModal && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4" onClick={() => setShowDeleteModal(false)}><div className="w-full max-w-sm rounded-2xl bg-[#222] p-6" onClick={(event) => event.stopPropagation()}><h2 className="text-lg font-black">Delete this video?</h2><p className="mt-2 text-sm text-[#aaa]">This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowDeleteModal(false)} className="rounded-full px-4 py-2 text-sm font-bold">Cancel</button><button onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-500 px-4 py-2 text-sm font-black">{deleting ? 'Deleting…' : 'Delete'}</button></div></div></div>}
    </div>
  )
}
