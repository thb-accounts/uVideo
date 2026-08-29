import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchContent, searchPublicVideos } from '../lib/contentApi'
import { relativeDate } from '../lib/relativeDate'

const categories = ['All', 'Tutorials', 'Coding', 'General']

function youtubeThumbnail(url = '') {
  const match = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/)
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : ''
}

function VideoThumbnail({ item }) {
  const thumbnail = item.thumbnail_url || youtubeThumbnail(item.media_url)
  return (
    <div className="video-card-shadow relative aspect-video overflow-hidden rounded-[18px] border border-[var(--app-border)] bg-gradient-to-br from-[#e8f4ed] via-[#f5f7f5] to-white transition duration-200 group-hover:-translate-y-0.5">
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : item.media_url && !item.media_url.includes('youtube') ? (
        <video src={item.media_url} muted preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 text-xl font-black text-[#126341] shadow-sm">▶</div></div>
      )}
      <span className="absolute bottom-2 right-2 rounded-md bg-[#142019]/85 px-1.5 py-0.5 text-[11px] font-bold text-white">{item.duration || 'VIDEO'}</span>
    </div>
  )
}

function VideoCard({ item }) {
  return (
    <Link to={`/video/${item.id}`} className="group min-w-0">
      <VideoThumbnail item={item} />
      <div className="mt-3 flex gap-3 px-0.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#126341] text-xs font-black text-white">{(item.username || 'M')[0].toUpperCase()}</div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] font-extrabold leading-5 text-[var(--app-text)]">{item.title}</h3>
          <p className="mt-1 truncate text-xs font-medium text-[var(--app-muted)]">{item.username ? `@${item.username}` : 'MPlace creator'}</p>
          <p className="text-xs text-[var(--app-muted)]">{relativeDate(item.created_at)}</p>
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const requestedCategory = params.get('category') || 'All'
  const requestedSearch = params.get('search') || ''
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const request = requestedSearch.trim() ? searchPublicVideos(requestedSearch) : fetchContent({ category: 'all', feed: 'videos' })
    request.then((content) => { if (!cancelled) setVideos(content || []) }).catch(() => { if (!cancelled) setError('MPlace Videos could not refresh right now. Please try again shortly.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [requestedSearch])

  const filteredVideos = useMemo(() => {
    const categoryNeedle = requestedCategory.toLowerCase().replace(/s$/, '')
    return videos.filter((item) => {
      if (requestedCategory === 'All') return true
      const searchable = `${item.title || ''} ${item.description || ''} ${item.category || ''} ${item.type || ''}`.toLowerCase()
      return searchable.includes(categoryNeedle)
    })
  }, [requestedCategory, videos])

  function categoryHref(category) {
    const next = new URLSearchParams(location.search)
    if (category === 'All') next.delete('category'); else next.set('category', category)
    return `/${next.toString() ? `?${next.toString()}` : ''}`
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6 lg:px-8">
      <section className="sticky top-16 z-30 -mx-4 border-b border-[var(--app-border)] bg-white/94 px-4 py-3 backdrop-blur-[18px] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((category) => <Link key={category} to={categoryHref(category)} className={`min-h-10 shrink-0 rounded-xl border px-4 py-2 text-sm font-bold transition ${requestedCategory === category ? 'border-[#cfe5d8] bg-[#e8f4ed] text-[#126341]' : 'border-[var(--app-border)] bg-white text-[var(--app-muted)] hover:bg-[var(--app-hover)]'}`}>{category}</Link>)}
          <Link to="/blinks" className="min-h-10 shrink-0 rounded-xl border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--app-muted)] hover:bg-[var(--app-hover)]">Blinks</Link>
        </div>
      </section>

      <section className="pt-7">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">{requestedSearch ? `Results for “${requestedSearch}”` : requestedCategory === 'All' ? 'Recommended' : requestedCategory}</h1><p className="mt-1 text-sm text-[var(--app-muted)]">Watch videos from across MPlace.</p></div>
          <Link to="/upload" className="hidden rounded-xl border border-[var(--app-border)] bg-white px-4 py-2.5 text-sm font-bold text-[#126341] shadow-sm hover:bg-[#e8f4ed] sm:block">Upload video</Link>
        </div>
        {loading ? <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-video rounded-[18px] bg-[#e6ebe7]"/><div className="mt-3 h-4 w-4/5 rounded bg-[#e6ebe7]"/><div className="mt-2 h-3 w-1/2 rounded bg-[#edf1ee]"/></div>)}</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : filteredVideos.length > 0 ? <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredVideos.map((item) => <VideoCard key={item.id} item={item} />)}</div> : <div className="rounded-3xl border border-dashed border-[var(--app-border)] bg-white p-12 text-center shadow-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f4ed] text-xl text-[#126341]">▶</div><p className="mt-4 text-lg font-bold">No videos here yet.</p><p className="mt-1 text-sm text-[var(--app-muted)]">Try another category or publish the first one.</p><Link to="/upload" className="mt-5 inline-block rounded-xl bg-[#126341] px-5 py-2.5 text-sm font-bold text-white">Create a video</Link></div>}
      </section>
    </div>
  )
}
