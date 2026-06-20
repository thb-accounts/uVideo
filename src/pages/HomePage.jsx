import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchContent, fetchProfilesBySearch } from '../lib/contentApi'

const categories = ['All', 'MathArt', 'Tutorials', 'Coding', 'Desmos', 'Shorts', 'UnrealCake8']
const gradients = [
  'from-[#073b4c] via-[#09647a] to-[#00a8cc]',
  'from-[#14213d] via-[#1d4e89] to-[#3e7bff]',
  'from-[#2b1b54] via-[#52348c] to-[#00c8ff]',
  'from-[#102a43] via-[#176b87] to-[#64ccc5]',
  'from-[#202020] via-[#154c79] to-[#3ea6ff]',
]

function youtubeThumbnail(url = '') {
  const match = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/)
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : ''
}

function relativeDate(value) {
  if (!value) return 'Recently uploaded'
  const days = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`
  return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
}

function VideoThumbnail({ item, index }) {
  const thumbnail = item.thumbnail_url || youtubeThumbnail(item.media_url)
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${gradients[index % gradients.length]}`}>
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
      ) : item.media_url && !item.media_url.includes('youtube') ? (
        <video src={item.media_url} muted preload="metadata" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-black/20 text-2xl font-black text-white backdrop-blur">U</span>
            <span className="mt-3 block text-xs font-bold uppercase tracking-[0.2em] text-white/65">UVideo original</span>
          </div>
        </div>
      )}
      <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold">{item.type === 'lesson' ? 'LESSON' : item.duration || 'VIDEO'}</span>
      {item.is_trending && <span className="absolute left-2 top-2 rounded-full bg-[#00c8ff] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#041015]">Featured</span>}
    </div>
  )
}

function VideoCard({ item, index }) {
  return (
    <Link to={`/video/${item.id}`} className="group min-w-0">
      <VideoThumbnail item={item} index={index} />
      <div className="mt-3 flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3ea6ff] to-[#00c8ff] text-xs font-black text-[#071219]">
          {(item.username || 'U')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white group-hover:text-[#d9f3ff]">{item.title}</h3>
          <p className="mt-1 truncate text-xs text-[#aaa]">{item.username ? `@${item.username}` : 'UVideo creators'}</p>
          <p className="text-xs text-[#aaa]">{item.views || item.view_count || 0} views · {relativeDate(item.created_at)}</p>
          {item.category && <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#bfe9ff]">{item.category}</span>}
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const search = params.get('q') || ''
  const requestedCategory = params.get('category') || 'All'
  const [activeCategory, setActiveCategory] = useState(requestedCategory)
  const [videos, setVideos] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => setActiveCategory(requestedCategory), [requestedCategory])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchContent({ search, category: 'all' }),
      search ? fetchProfilesBySearch(search) : Promise.resolve([]),
    ]).then(([content, matchedProfiles]) => {
      if (!cancelled) {
        setVideos(content || [])
        setProfiles(matchedProfiles || [])
      }
    }).catch(() => {
      if (!cancelled) setError('UVideo could not refresh the catalog. Please try again shortly.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [search])

  const filteredVideos = useMemo(() => {
    if (activeCategory === 'All') return videos
    const needle = activeCategory.toLowerCase().replace(/s$/, '')
    return videos.filter((item) => `${item.category || ''} ${item.type || ''} ${item.title || ''}`.toLowerCase().includes(needle))
  }, [activeCategory, videos])

  function selectCategory(category) {
    setActiveCategory(category)
    const next = new URLSearchParams(location.search)
    if (category === 'All') next.delete('category')
    else next.set('category', category)
    navigate(`/${next.toString() ? `?${next}` : ''}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6 lg:px-8">
      <section className="sticky top-16 z-30 -mx-4 border-b border-white/5 bg-[#0f0f0f]/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((category) => (
            <button key={category} onClick={() => selectCategory(category)} className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${activeCategory === category ? 'bg-white text-[#0f0f0f]' : 'bg-[#272727] text-white hover:bg-[#3a3a3a]'}`}>
              {category}
            </button>
          ))}
        </div>
      </section>

      {!search && (
        <section className="relative mt-6 overflow-hidden rounded-2xl border border-[#3ea6ff]/20 bg-gradient-to-r from-[#111d2a] via-[#102838] to-[#07191f] p-6 sm:p-8">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#00c8ff]/15 blur-3xl" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#61d8ff]">Create · Learn · Share</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Videos for creators, coders, and MathArt makers.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#b9c5cc] sm:text-base">Discover visual math, practical tutorials, creative coding, and original videos on UVideo.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="https://unrealcake8.site" className="rounded-full bg-[#3ea6ff] px-5 py-2.5 text-sm font-black text-[#06131c] transition hover:bg-[#70bdff]">Explore the UC8 Foundation ↗</a>
           </div>
          </div>
        </section>
      )}

      {search && <div className="py-6"><h1 className="text-2xl font-black">Results for “{search}”</h1><p className="mt-1 text-sm text-[#aaa]">Videos and creators across UVideo</p></div>}

      {profiles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold">Channels</h2>
          <div className="flex gap-3 overflow-x-auto">
            {profiles.map((profile) => <Link key={profile.id} to={`/u/${profile.username}`} className="flex min-w-60 items-center gap-3 rounded-xl bg-[#181818] p-3 hover:bg-[#272727]"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#3ea6ff] font-black text-black">{(profile.display_name || profile.username || 'U')[0].toUpperCase()}</span><span><strong className="block text-sm">{profile.display_name || profile.username}</strong><small className="text-[#aaa]">@{profile.username}</small></span></Link>)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><h2 className="text-xl font-black">{activeCategory === 'All' ? 'Recommended' : activeCategory}</h2><p className="mt-1 text-sm text-[#888]">Fresh videos from UVideo creators</p></div>
          <Link to="/shorts" className="text-sm font-bold text-[#3ea6ff] hover:text-[#77c3ff]">Open Shorts →</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-video rounded-xl bg-[#202020]"/><div className="mt-3 h-4 w-4/5 rounded bg-[#202020]"/><div className="mt-2 h-3 w-1/2 rounded bg-[#181818]"/></div>)}</div>
        ) : error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
          : filteredVideos.length > 0 ? <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredVideos.map((item, index) => <VideoCard key={item.id} item={item} index={index} />)}</div>
            : <div className="rounded-2xl border border-dashed border-white/15 bg-[#151515] p-10 text-center"><p className="text-lg font-bold">No videos in this category yet.</p><p className="mt-2 text-sm text-[#aaa]">Be the first creator to publish one.</p><Link to="/upload" className="mt-5 inline-block rounded-full bg-[#3ea6ff] px-5 py-2 text-sm font-black text-[#06131c]">Upload a video</Link></div>}
      </section>

      <footer className="mt-14 border-t border-white/10 py-8 text-xs leading-5 text-[#777]">
        <p>UVideo is an open-source platform made by the UC8 Foundation, which is not a company.</p>
      </footer>
    </div>
  )
}
