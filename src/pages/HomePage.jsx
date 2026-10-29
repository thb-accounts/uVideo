import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchContent, fetchProfileAvatarsByUserIds, searchPublicVideos } from '../lib/contentApi'
import { relativeDate } from '../lib/relativeDate'
import { getOfflineItems, prefetchVideos } from '../lib/offlineStore'
import { isShortContent } from '../lib/contentApi'
import { useOnline } from '../lib/useOnline'
import { useOfflineLibrary } from '../hooks/useOfflineLibrary'
import OfflineCollection from '../components/OfflineCollection'

const baseCategories = ['All', 'Tutorials', 'Coding', 'General']
const PlayIcon = () => <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>

function youtubeThumbnail(url='') {
  const match=url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/)
  return match?`https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`:''
}

function VideoThumbnail({item}) {
  const thumbnail=item.thumbnail_url||youtubeThumbnail(item.media_url)
  return <div className="video-thumbnail relative aspect-video overflow-hidden rounded-xl bg-[#e8eaed]">
    {thumbnail?<img src={thumbnail} alt="" className="h-full w-full object-cover" loading="lazy"/>:item.media_url&&!item.media_url.includes('youtube')?<video src={item.media_url} muted preload="metadata" className="h-full w-full object-cover"/>:<div className="absolute inset-0 grid place-items-center text-[var(--app-muted)]"><PlayIcon/></div>}
    {item.duration&&<span className="absolute bottom-2 right-2 rounded bg-[#202124]/90 px-1.5 py-0.5 text-[11px] font-medium text-white">{item.duration}</span>}
  </div>
}

function VideoCard({item, avatarUrl=''}) {
  return <Link to={`/video/${item.id}`} className="video-card group min-w-0">
    <VideoThumbnail item={item}/>
    <div className="mt-3 flex gap-3">
      {avatarUrl?<img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover"/>:<div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7f3ec] text-xs font-medium text-[#185c3d]">{(item.username||'M')[0].toUpperCase()}</div>}
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-5 text-[var(--app-text)] group-hover:text-[#185c3d]">{item.title}</h3>
        <p className="mt-1 truncate text-[13px] text-[var(--app-muted)]">{item.username?`@${item.username}`:'MPlace creator'}</p>
        <p className="text-[13px] text-[var(--app-muted)]">{relativeDate(item.created_at)}</p>
      </div>
    </div>
  </Link>
}

export default function HomePage(){
  const location=useLocation()
  const online=useOnline()
  const { items: offlineItems } = useOfflineLibrary()
  const params=new URLSearchParams(location.search)
  const requestedCategory=params.get('category')||'All'
  const requestedSearch=params.get('search')||''
  const [videos,setVideos]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [avatars,setAvatars]=useState({})
  const [sort,setSort]=useState('latest')
  const categories = useMemo(() => [...new Set([...baseCategories, ...videos.map(video => video.category).filter(Boolean)])].slice(0, 12), [videos])

  useEffect(()=>{
    let cancelled=false; setLoading(true); setError('')
    if(!online){setVideos(getOfflineItems().filter(item=>!isShortContent(item)));setLoading(false);return}
    const request=requestedSearch.trim()?searchPublicVideos(requestedSearch):fetchContent({category:'all',feed:'videos'})
    request.then(async content=>{if(cancelled)return; const next=content||[]; setVideos(next); prefetchVideos(next); try { const map=await fetchProfileAvatarsByUserIds(next.map(item=>item.user_id)); if(!cancelled)setAvatars(map) } catch { if(!cancelled)setAvatars({}) }}).catch(()=>{if(!cancelled){const saved=getOfflineItems().filter(item=>!isShortContent(item));setVideos(saved);if(!saved.length)setError('No downloaded videos are available yet. Browse videos while online to prepare some.')}}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[requestedSearch,online])

  const filteredVideos=useMemo(()=>{
    const needle=requestedCategory.toLowerCase().replace(/s$/,'')
    return videos.filter(item=>(!requestedSearch || `${item.title||''} ${item.description||''}`.toLowerCase().includes(requestedSearch.toLowerCase()))).filter(item=>requestedCategory==='All'||`${item.title||''} ${item.description||''} ${item.category||''} ${item.type||''}`.toLowerCase().includes(needle))
    .sort((a,b)=>sort==='title' ? (a.title||'').localeCompare(b.title||'') : new Date(b.created_at||0)-new Date(a.created_at||0))
  },[requestedCategory,requestedSearch,videos,sort])

  function categoryHref(category){const next=new URLSearchParams(location.search);if(category==='All')next.delete('category');else next.set('category',category);return `/${next.toString()?`?${next}`:''}`}

  if (!online) return <OfflineCollection items={offlineItems.filter(item => !isShortContent(item))}/>

  return <div className="home-layout mx-auto max-w-[1680px] px-4 pb-14 sm:px-8 lg:px-10">
    {!requestedSearch && requestedCategory === 'All' && <section className="discovery-banner mt-7 flex flex-wrap items-center justify-between gap-6 rounded-3xl p-6 sm:p-8">
      <div><p className="eyebrow">YOUR DAILY DOSE OF DISCOVERY</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A little curiosity.<br/>Something worth watching.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[var(--app-muted)]">Fresh perspectives, useful ideas, and creators with something to share.</p></div>
      <Link to="/blinks" className="blinks-entry flex items-center gap-4 rounded-2xl p-5"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-[var(--brand-primary)]"><PlayIcon/></span><span><strong className="block text-base">Short on time?</strong><span className="mt-1 block text-sm text-[var(--app-muted)]">Explore Blinks ↗</span></span></Link>
    </section>}
    <div className="category-bar sticky top-16 z-30 -mx-4 bg-[var(--app-bg)] px-4 py-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <nav aria-label="Video categories" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {categories.map(category=><Link key={category} aria-current={requestedCategory===category?'page':undefined} to={categoryHref(category)} className={`category-chip shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${requestedCategory===category?'selected':'bg-white text-[var(--app-muted)]'}`}>{category}</Link>)}
      </nav>
    </div>
    <section className="pt-1">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">{requestedSearch?`Results for “${requestedSearch}”`:requestedCategory==='All'?'Fresh finds':requestedCategory}</h2><p className="mt-1.5 text-sm text-[var(--app-muted)]">{!online?'Offline · videos saved on this device.':requestedSearch?`${filteredVideos.length} videos found`:'Find your next favourite.'}</p></div>
        <label className="flex items-center gap-2 text-sm text-[var(--app-muted)]">Sort by <select aria-label="Sort videos" value={sort} onChange={event=>setSort(event.target.value)} className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-[var(--app-text)]"><option value="latest">Latest</option><option value="title">Title A–Z</option></select></label>
      </div>
      {loading?<div aria-label="Loading videos" className="video-grid grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="animate-pulse"><div className="aspect-video rounded-2xl bg-[#e8eaed]"/><div className="mt-3 h-4 w-4/5 rounded bg-[#e8eaed]"/><div className="mt-2 h-3 w-1/2 rounded bg-[#eef0f1]"/></div>)}</div>:error?<div role="alert" className="rounded-xl border border-[#f3c7c3] bg-[#fce8e6] p-4 text-sm text-[#8c1d18]">{error}</div>:filteredVideos.length?<div className="video-grid grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredVideos.map(item=><VideoCard key={item.id} item={item} avatarUrl={avatars[item.user_id]||item.avatar_url||''}/>)}</div>:<div className="empty-state flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--app-border)] p-6 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f3ec] text-[#185c3d]"><PlayIcon/></div><p className="mt-4 text-lg font-bold">Nothing here just yet</p><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--app-muted)]">{online?'Try another category or search, or share a video of your own.':'Browse while online to prepare videos for later.'}</p><Link to={requestedSearch||requestedCategory!=='All'?'/':'/upload'} className="brand-button mt-5 rounded-full px-5 py-3 text-sm font-bold">{requestedSearch||requestedCategory!=='All'?'Browse all videos':'Create video'}</Link></div>}
    </section>
  </div>
}
