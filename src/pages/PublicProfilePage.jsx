import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import {
  fetchVideosByUsername,
  getProfileByUsername,
  getUserIdByUsername,
  fetchFollowStatus,
  followUser,
  unfollowUser,
  fetchFollowerCount,
  fetchFollowingCount,
  fetchFollowersForUser,
  fetchFollowingForUser,
} from '../lib/contentApi'

function SocialAccountList({ title, entries, idKey, emptyMessage }) {
  return (
    <div className="mt-5 w-full max-w-sm rounded-2xl bg-white/5 p-4 text-left">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/45">{title}</p>
      <div className="space-y-3">
        {entries.length === 0 && <p className="text-sm text-white/45">{emptyMessage}</p>}
        {entries.map((entry) => {
          const account = entry.profiles
          const linkedUsername = account?.username || 'user'
          return (
            <Link key={entry[idKey]} to={`/u/${linkedUsername}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/10">
              {account?.avatar_url ? (
                <img src={account.avatar_url} alt={`${linkedUsername} avatar`} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#151a17] text-base font-black text-white/45">
                  {(account?.display_name || linkedUsername || '?')[0].toUpperCase()}
                </span>
              )}
              <span>
                <span className="block text-sm font-bold text-white">{account?.display_name || linkedUsername}</span>
                <span className="block text-xs text-white/50">@{linkedUsername}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function PublicProfileAvatar({ profile, username }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={`${username} avatar`} className="h-full w-full rounded-full object-cover" />
  }

  return (
    <span className="grid h-full w-full place-items-center rounded-full bg-[#151a17] text-3xl font-black text-white/50">
      {(profile?.display_name || username || '?')[0].toUpperCase()}
    </span>
  )
}

function VideoGrid({ videos }) {
  if (videos.length === 0) {
    return (
      <div className="border-t border-white/10 py-12 text-center text-white/50">
        <p className="text-lg font-semibold">No posts yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-px bg-black">
      {videos.map((video) => {
        const isDirectVideo = video.media_url?.toLowerCase().endsWith('.mp4')
        return (
          <Link key={video.id} to={`/video/${video.id}`} className="relative aspect-[9/14] overflow-hidden bg-zinc-900">
            {isDirectVideo ? (
              <video src={video.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black p-2 text-center text-xs font-semibold text-white/70">
                {video.title}
              </div>
            )}
            {video.is_pinned && <span className="absolute left-0 top-3 bg-[var(--brand-leaf)] px-2 py-0.5 text-xs font-black">Pinned</span>}
            <span className="absolute bottom-2 left-2 text-xs font-bold drop-shadow">▷ {video.like_count || 0}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function PublicProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [videos, setVideos] = useState([])
  const [profileUserId, setProfileUserId] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [activeSocialList, setActiveSocialList] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [loadError, setLoadError] = useState('')
  const isSelf = Boolean(user?.id && profileUserId && user.id === profileUserId)
  const totalLikes = videos.reduce((sum, video) => sum + Number(video.like_count || 0), 0)
  const displayName = profile?.display_name || username || 'Creator'

  const tabs = [
    { icon: '▦', label: 'Posts' },
    { icon: '▣', label: 'Archive' },
    { icon: '↕', label: 'Reposts' },
    { icon: '♡', label: 'Likes' },
    { icon: '♡', label: 'Saved' },
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadError('')
      try {
        const [profileData, userId] = await Promise.all([
          getProfileByUsername(username),
          getUserIdByUsername(username),
        ])
        const videosData = await fetchVideosByUsername(profileData?.username || username, userId)
        if (cancelled) return
        setProfile(profileData)
        setVideos(videosData)
        setProfileUserId(userId)
      } catch (error) {
        console.error('Profile load failed:', error)
        if (!cancelled) setLoadError('Unable to load this creator profile right now.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    if (!profileUserId) return
    async function loadSocialStats() {
      try {
      const [followerCount, followingCountValue, followersData, followingData] = await Promise.all([
        fetchFollowerCount(profileUserId),
        fetchFollowingCount(profileUserId),
        fetchFollowersForUser(profileUserId),
        fetchFollowingForUser(profileUserId),
      ])
      setFollowersCount(followerCount)
      setFollowingCount(followingCountValue)
      setFollowers(followersData)
      setFollowing(followingData)
      if (user?.id && user.id !== profileUserId) {
        const status = await fetchFollowStatus(user.id, profileUserId)
        setIsFollowing(status)
      } else {
        setIsFollowing(false)
      }
      } catch (error) {
        console.error('Profile social stats failed:', error)
      }
    }
    loadSocialStats()
  }, [profileUserId, user?.id])

  async function handleFollowToggle() {
    if (!user?.id || !profileUserId || isSelf) return
    const next = !isFollowing
    setIsFollowing(next)
    setFollowersCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)))
    try {
      if (next) await followUser(user.id, profileUserId)
      else await unfollowUser(user.id, profileUserId)
    } catch {
      setIsFollowing(!next)
      setFollowersCount((prev) => (!next ? prev + 1 : Math.max(0, prev - 1)))
    }
  }

  return (
    <div className="theme-app-bg space-y-4 p-4 lg:p-4">
      {loadError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{loadError}</p>}
      <section className="-mx-4 -mt-4 min-h-screen bg-[#121212] px-4 pb-28 pt-20 text-white lg:hidden">
        <div className="flex flex-col items-center text-center">
          <div className="relative h-20 w-20 rounded-full border border-white/20 bg-[#151a17]">
            <PublicProfileAvatar profile={profile} username={username} />
          </div>
          <div className="mt-4 flex max-w-full items-center justify-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight">{displayName}</h1>
            {!isSelf && (
              <button
                onClick={handleFollowToggle}
                disabled={!user?.id || !profileUserId}
                className={`rounded-full px-4 py-1.5 text-base font-bold ${isFollowing ? 'bg-white/15 text-white' : 'bg-[var(--brand-olive)] text-white'} disabled:opacity-50`}
              >
                {isFollowing ? 'Subscribed' : 'Subscribe'}
              </button>
            )}
          </div>
          <p className="text-lg text-white/55">@{username}</p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-3 divide-x divide-white/10">
            <button type="button" onClick={() => setActiveSocialList((current) => (current === 'following' ? '' : 'following'))}>
              <p className="text-3xl font-black">{followingCount}</p>
              <p className="text-lg text-white/55">Subscriptions</p>
            </button>
            <button type="button" onClick={() => setActiveSocialList((current) => (current === 'followers' ? '' : 'followers'))}>
              <p className="text-3xl font-black">{followersCount}</p>
              <p className="text-lg text-white/55">Subscribers</p>
            </button>
            <div>
              <p className="text-3xl font-black">{totalLikes}</p>
              <p className="text-lg text-white/55">Likes</p>
            </div>
          </div>
          {profile?.bio ? <p className="mt-5 text-xl">{profile.bio}</p> : <p className="mt-5 text-base text-white/45">No bio yet.</p>}
          {activeSocialList === 'following' && (
            <SocialAccountList title="Subscriptions" entries={following} idKey="following_id" emptyMessage="No subscriptions yet." />
          )}
          {activeSocialList === 'followers' && (
            <SocialAccountList title="Subscribers" entries={followers} idKey="follower_id" emptyMessage="No subscribers yet." />
          )}
        </div>

        <div className="mt-8 grid grid-cols-5 items-end border-b border-white/20 text-white/55">
          {tabs.map((tab, index) => (
            <button
              key={`${tab.icon}-${index}`}
              onClick={() => setActiveTab(index)}
              className={`pb-3 text-3xl ${activeTab === index ? 'border-b-2 border-white text-white' : ''}`}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {activeTab === 0 ? (
          <VideoGrid videos={videos} />
        ) : (
          <div className="border-t border-white/10 py-12 text-center text-white/50">
            <p className="text-lg font-semibold">No {tabs[activeTab].label.toLowerCase()} yet</p>
          </div>
        )}
      </section>

      <section className="theme-card hidden rounded-2xl border p-4 space-y-3 lg:block">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-full">
              <PublicProfileAvatar profile={profile} username={username} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--brand-olive)]">@{username}</h1>
              <p className="theme-muted">{profile?.display_name || 'UVideo creator'}</p>
              <p className="text-sm theme-muted">{profile?.bio || 'No bio yet.'}</p>
            </div>
          </div>
          {!isSelf && (
            <button
              onClick={handleFollowToggle}
              disabled={!user?.id || !profileUserId}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                isFollowing ? 'bg-black/15 text-current' : 'bg-[var(--brand-olive)] text-white'
              } disabled:opacity-50`}
            >
              {isFollowing ? 'Subscribed' : 'Subscribe'}
            </button>
          )}
        </div>
        <div className="flex gap-6 text-sm">
          <p><span className="font-bold">{videos.length}</span> posts</p>
          <button type="button" onClick={() => setActiveSocialList('followers')}><span className="font-bold">{followersCount}</span> subscribers</button>
          <button type="button" onClick={() => setActiveSocialList('following')}><span className="font-bold">{followingCount}</span> subscriptions</button>
        </div>
      </section>

      <section className="hidden gap-3 md:grid-cols-2 lg:grid">
        <div className="theme-card rounded-2xl border p-4">
          <p className="mb-2 text-sm font-semibold theme-muted">Subscribers</p>
          <div className="space-y-2">
            {followers.length === 0 && <p className="text-sm theme-muted">No subscribers yet.</p>}
            {followers.slice(0, 8).map((entry) => (
              <Link key={entry.follower_id} to={`/u/${entry.profiles?.username || 'user'}`} className="block text-sm theme-muted hover:text-current">
                @{entry.profiles?.username || 'user'} · {entry.profiles?.display_name || 'UVideo user'}
              </Link>
            ))}
          </div>
        </div>
        <div className="theme-card rounded-2xl border p-4">
          <p className="mb-2 text-sm font-semibold theme-muted">Subscriptions</p>
          <div className="space-y-2">
            {following.length === 0 && <p className="text-sm theme-muted">No subscriptions yet.</p>}
            {following.slice(0, 8).map((entry) => (
              <Link key={entry.following_id} to={`/u/${entry.profiles?.username || 'user'}`} className="block text-sm theme-muted hover:text-current">
                @{entry.profiles?.username || 'user'} · {entry.profiles?.display_name || 'UVideo user'}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hidden grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-3">
        {videos.map((video) => (
          <Link key={video.id} to={`/video/${video.id}`} className="theme-card rounded-xl border p-3 hover:bg-black/10">
            <p className="text-xs uppercase theme-muted">{video.type}</p>
            <p className="font-semibold">{video.title}</p>
            <p className="text-sm theme-muted line-clamp-2">{video.description}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
