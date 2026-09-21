import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCreatorProfile, getCreatorProfileById, isShortContent } from '../lib/contentApi'

function ContentThumbnail({ item, portrait = false }) {
  const mediaUrl = item.thumbnail_url || item.media_url || ''
  const isVideo = !item.thumbnail_url && Boolean(item.media_url)

  return (
    <div className={`${portrait ? 'aspect-[9/16]' : 'aspect-video'} overflow-hidden bg-[#eef2ef]`}>
      {mediaUrl ? (
        isVideo
          ? <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          : <img src={mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full place-items-center px-4 text-center text-sm text-[#66736b]">
          {item.title || (portrait ? 'Untitled Blink' : 'Untitled video')}
        </div>
      )}
    </div>
  )
}

function ContentSection({ title, items, portrait = false }) {
  if (items.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-semibold text-[#202124]">{title}</h2>
      <div className={portrait
        ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
        : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'}>
        {items.map((item) => (
          <Link key={item.id} to={`/video/${item.id}`} className="group overflow-hidden rounded-xl border bg-white">
            <ContentThumbnail item={item} portrait={portrait} />
            <div className="p-3">
              <p className="line-clamp-2 font-semibold text-[#202124] group-hover:text-[#185c3d]">
                {item.title || (portrait ? 'Untitled Blink' : 'Untitled video')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function PublicProfilePage() {
  const { username: routeUsername = '', profileId = '' } = useParams()
  const [data, setData] = useState({ loading: true, error: '', profile: null, videos: [] })

  useEffect(() => {
    let alive = true
    const username = routeUsername ? decodeURIComponent(routeUsername) : ''
    const request = profileId ? getCreatorProfileById(profileId) : getCreatorProfile(username)
    request.then((result) => {
      if (!alive) return
      setData({
        loading: false,
        error: '',
        profile: result?.profile || null,
        videos: Array.isArray(result?.videos) ? result.videos : [],
      })
    }).catch((error) => {
      console.error('Public profile failed', error)
      if (alive) setData({ loading: false, error: error?.message || 'Profile failed to load', profile: null, videos: [] })
    })
    return () => { alive = false }
  }, [routeUsername, profileId])

  if (data.loading) return <div className="p-8">Loading channel…</div>
  if (data.error) return <div className="p-8"><h1 className="text-xl font-semibold">Channel unavailable</h1><p className="mt-2">{data.error}</p></div>

  const profile = data.profile || {}
  const name = profile.display_name || profile.username || 'Creator'
  const handle = profile.username || 'creator'
  const totalLikes = data.videos.reduce((sum, video) => sum + Number(video?.like_count || 0), 0)
  const blinks = data.videos.filter(isShortContent)
  const videos = data.videos.filter((video) => !isShortContent(video))

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
            : <div className="grid h-20 w-20 rounded-full bg-[#e8eee9] place-items-center text-2xl font-bold">{String(name).charAt(0).toUpperCase()}</div>}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{name}</h1>
            <p className="truncate text-sm text-[#66736b]">@{handle}</p>
            {profile.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}
          </div>
        </div>
        <div className="mt-6 flex gap-8 border-t pt-4 text-sm">
          <span><strong>{data.videos.length}</strong> posts</span>
          <span><strong>{totalLikes}</strong> likes</span>
        </div>
      </section>

      {data.videos.length === 0
        ? <div className="py-12 text-center text-sm text-[#66736b]">No posts yet</div>
        : (
          <>
            <ContentSection title="Videos" items={videos} />
            <ContentSection title="Blinks" items={blinks} portrait />
          </>
        )}
    </main>
  )
}
