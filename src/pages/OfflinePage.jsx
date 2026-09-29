import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { forgetOfflineItem, getOfflineItems } from '../lib/offlineStore'

export default function OfflinePage() {
  const [items, setItems] = useState(getOfflineItems)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const refresh = () => setItems(getOfflineItems())
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('mplace-offline-changed', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('mplace-offline-changed', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  function remove(id) {
    forgetOfflineItem(id)
    navigator.serviceWorker?.controller?.postMessage({ type: 'OFFLINE_REMOVE', id })
  }

  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-[#1f6f4a]">MPlace Offline</p><h1 className="mt-1 text-3xl font-medium text-[#202124]">Watch without a connection</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6368]">MPlace keeps a small rotating set of Blinks ready on this device. Videos you explicitly save stay here until you remove them.</p></div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${online?'bg-[#e7f3ec] text-[#185c3d]':'bg-[#fce8e6] text-[#a50e0e]'}`}>{online?'Online · refreshing cache':'Offline · using this device'}</span>
    </div>

    {items.length === 0 ? <div className="mt-10 rounded-2xl border border-[var(--app-border)] bg-white p-8 text-center"><h2 className="text-lg font-medium text-[#202124]">Nothing offline yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#5f6368]">Watch Blinks while online and MPlace will prepare upcoming compatible videos automatically.</p><Link to="/blinks" className="mt-5 inline-flex rounded-full bg-[#1f6f4a] px-5 py-2.5 text-sm font-medium text-white">Browse Blinks</Link></div> :
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white"><div className="aspect-video bg-black">{item.media_url?<video className="h-full w-full object-contain" src={item.media_url} controls preload="metadata" poster={item.thumbnail_url||undefined}/>:null}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="line-clamp-2 font-medium text-[#202124]">{item.title}</h2>{item.username&&<p className="mt-1 text-xs text-[#5f6368]">@{item.username}</p>}</div>{item.persistent&&<span className="rounded-full bg-[#e7f3ec] px-2 py-1 text-[10px] font-medium text-[#185c3d]">Saved</span>}</div><button onClick={()=>remove(item.id)} className="mt-4 text-xs font-medium text-[#5f6368] hover:text-[#202124]">Remove from device</button></div></article>)}</div>}
  </div>
}
