import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { getCreatorProfile, getCreatorProfileById } from '../lib/contentApi'

function Avatar({ profile }) {
  const label = profile?.display_name || profile?.username || 'Creator'
  return profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
    : <span className="grid h-full w-full place-items-center rounded-full bg-[#e8eee9] text-2xl font-bold text-[#44534a]">{label[0]?.toUpperCase()}</span>
}

function Posts({ videos }) {
  if (!videos.length) return <div className="border-t py-12 text-center text-sm text-[#66736b]">No posts yet</div>
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{videos.map(video => (
    <Link key={video.id} to={`/video/${video.id}`} className="overflow-hidden rounded-xl border bg-white">
      <div className="aspect-video bg-[#eef2ef]">
        {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" /> : video.media_url?.toLowerCase().includes('.mp4') ? <video src={video.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : null}
      </div>
      <div className="p-3"><p className="line-clamp-2 font-semibold text-[#202522]">{video.title || 'Untitled video'}</p><p className="mt-1 text-xs text-[#66736b]">{Number(video.like_count || 0)} likes</p></div>
    </Link>
  ))}</div>
}

export default function PublicProfilePage() {
  const { username: routeUsername, profileId } = useParams()
  const username = decodeURIComponent(routeUsername || '').trim()
  const [state, setState] = useState({ loading: true, error: '', profile: null, videos: [] })

  useEffect(() => {
    let active = true
    setState({ loading: true, error: '', profile: null, videos: [] })
    (profileId ? getCreatorProfileById(profileId) : getCreatorProfile(username)).then(data => {
      if (active) setState({ loading: false, error: '', ...data })
    }).catch(error => {
      console.error('Creator profile load failed', error)
      if (active) setState({ loading: false, error: 'This creator profile could not be loaded.', profile: null, videos: [] })
    })
    return () => { active = false }
  }, [username, profileId])

  const likes = useMemo(() => state.videos.reduce((n, v) => n + Number(v.like_count || 0), 0), [state.videos])
  if (state.loading) return <div className="mx-auto max-w-5xl p-6 text-sm text-[#66736b]">Loading creator…</div>
  if (state.error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Creator unavailable</h1><p className="mt-2 text-sm text-[#66736b]">{state.error}</p></div></div>

  const profile = state.profile || { username, display_name: username }
  return <main className="mx-auto max-w-5xl p-4 md:p-6">
    <section className="rounded-2xl border bg-white p-5 md:p-7">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 rounded-full"><Avatar profile={profile} /></div>
        <div className="min-w-0"><h1 className="truncate text-2xl font-semibold text-[#202522]">{profile.display_name || profile.username}</h1><p className="truncate text-sm text-[#66736b]">@{profile.username || username}</p>{profile.bio && <p className="mt-3 text-sm text-[#39443e]">{profile.bio}</p>}</div>
      </div>
      <div className="mt-6 flex gap-8 border-t pt-4 text-sm"><span><strong>{state.videos.length}</strong> posts</span><span><strong>{likes}</strong> likes</span></div>
    </section>
    <section className="mt-5"><Posts videos={state.videos} /></section>
  </main>
}
