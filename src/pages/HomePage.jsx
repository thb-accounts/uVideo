import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchContent, searchPublicVideos } from '../lib/contentApi'
import { relativeDate } from '../lib/relativeDate'

const categories = ['All', 'Tutorials', 'Coding', 'General']
const PlayIcon = () => <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>

function youtubeThumbnail(url='') {
  const match=url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{6,})/)
  return match?`https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`:''
}

function VideoThumbnail({item}) {
  const thumbnail=item.thumbnail_url||youtubeThumbnail(item.media_url)
  return <div className="relative aspect-video overflow-hidden rounded-xl bg-[#e8eaed]">
    {thumbnail?<img src={thumbnail} alt="" className="h-full w-full object-cover" loading="lazy"/>:item.media_url&&!item.media_url.includes('youtube')?<video src={item.media_url} muted preload="metadata" className="h-full w-full object-cover"/>:<div className="absolute inset-0 grid place-items-center text-[#5f6368]"><PlayIcon/></div>}
    {item.duration&&<span className="absolute bottom-2 right-2 rounded bg-[#202124]/90 px-1.5 py-0.5 text-[11px] font-medium text-white">{item.duration}</span>}
  </div>
}

function VideoCard({item}) {
  return <Link to={`/video/${item.id}`} className="group min-w-0">
    <VideoThumbnail item={item}/>
    <div className="mt-3 flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7f3ec] text-xs font-medium text-[#185c3d]">{(item.username||'M')[0].toUpperCase()}</div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-5 text-[#202124] group-hover:text-[#185c3d]">{item.title}</h3>
        <p className="mt-1 truncate text-[13px] text-[#5f6368]">{item.username?`@${item.username}`:'MPlace creator'}</p>
        <p className="text-[13px] text-[#5f6368]">{relativeDate(item.created_at)}</p>
      </div>
    </div>
  </Link>
}

export default function HomePage(){
  const location=useLocation()
  const params=new URLSearchParams(location.search)
  const requestedCategory=params.get('category')||'All'
  const requestedSearch=params.get('search')||''
  const [videos,setVideos]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false; setLoading(true); setError('')
    const request=requestedSearch.trim()?searchPublicVideos(requestedSearch):fetchContent({category:'all',feed:'videos'})
    request.then(content=>{if(!cancelled)setVideos(content||[])}).catch(()=>{if(!cancelled)setError('Videos could not be refreshed. Try again in a moment.')}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[requestedSearch])

  const filteredVideos=useMemo(()=>{
    const needle=requestedCategory.toLowerCase().replace(/s$/,'')
    return videos.filter(item=>requestedCategory==='All'||`${item.title||''} ${item.description||''} ${item.category||''} ${item.type||''}`.toLowerCase().includes(needle))
  },[requestedCategory,videos])

  function categoryHref(category){const next=new URLSearchParams(location.search);if(category==='All')next.delete('category');else next.set('category',category);return `/${next.toString()?`?${next}`:''}`}

  return <div className="mx-auto max-w-[1680px] px-5 pb-14 sm:px-8 lg:px-10">
    <div className="sticky top-16 z-30 -mx-5 bg-[var(--app-bg)] px-5 py-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {categories.map(category=><Link key={category} to={categoryHref(category)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${requestedCategory===category?'bg-[#dfe4e1] text-[#202124]':'bg-[#eef1ef] text-[#3c4043] hover:bg-[#e3e6e4]'}`}>{category}</Link>)}
      </div>
    </div>
    <section className="pt-4">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium tracking-[-.01em] text-[#202124] sm:text-2xl">{requestedSearch?`Search results for “${requestedSearch}”`:requestedCategory==='All'?'Videos for you':requestedCategory}</h1>
        {!requestedSearch&&<p className="mt-1 text-sm text-[#5f6368]">Discover videos from MPlace creators.</p>}
      </div>
      {loading?<div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="animate-pulse"><div className="aspect-video rounded-xl bg-[#e8eaed]"/><div className="mt-3 h-4 w-4/5 rounded bg-[#e8eaed]"/><div className="mt-2 h-3 w-1/2 rounded bg-[#eef0f1]"/></div>)}</div>:error?<div className="rounded-xl border border-[#f3c7c3] bg-[#fce8e6] p-4 text-sm text-[#8c1d18]">{error}</div>:filteredVideos.length?<div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredVideos.map(item=><VideoCard key={item.id} item={item}/>)}</div>:<div className="flex min-h-[320px] flex-col items-center justify-center text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#e7f3ec] text-[#185c3d]"><PlayIcon/></div><p className="mt-4 text-base font-medium text-[#202124]">No videos found</p><p className="mt-1 max-w-sm text-sm text-[#5f6368]">Try another category or search for something else.</p><Link to="/upload" className="mt-5 rounded-full bg-[#1f6f4a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#185c3d]">Create video</Link></div>}
    </section>
  </div>
}
