import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchContent,
  fetchFollowingForUser,
  fetchFollowingIds,
  fetchFollowNotifications,
  fetchProfileAvatarsByUserIds,
  fetchProfilesBySearch,
} from '../lib/contentApi'
import { useAuth } from '../context/useAuth'
import FeedItem from '../components/FeedItem'
import {
  acknowledge80,
  acknowledgeLimit,
  acknowledgeSessionPrompt,
  addExtension,
  addUsageSeconds,
  getDayString,
  markVideoSeen,
  readUsageSettings,
  readUsageState,
  resetSession,
  saveUsageSettings,
} from '../lib/usageLimits'

const feedModes = ['for-you', 'following', 'explore']

function MindfulModal({
  type,
  settings,
  usage,
  onClose,
  onTakeBreak,
  onContinue,
}) {
  const [confirming, setConfirming] = useState(false)
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!confirming) return
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [confirming, countdown])

  function handleConfirmContinue() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    if (countdown > 0) return
    onContinue()
  }

  const title =
    type === 'eighty'
      ? 'You are close to today\'s watch goal'
      : type === 'session'
        ? 'Session complete'
        : 'You reached your watch goal'

  const body =
    type === 'eighty'
      ? `Today: ${Math.round(usage.minutesUsed)} / ${settings.dailyLimitMinutes} minutes.`
      : type === 'session'
        ? `You watched ${usage.sessionVideos} videos in this session.`
        : `Today: ${Math.round(usage.minutesUsed)} / ${settings.dailyLimitMinutes + usage.extraMinutes} minutes.`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="theme-card w-full max-w-md rounded-2xl border p-4" onClick={(event) => event.stopPropagation()}>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm theme-muted">{body}</p>
        <div className="mt-4 grid gap-2">
          <button className="rounded-full bg-white/10 px-4 py-2 text-sm" onClick={onTakeBreak}>Take a short break</button>
          <button className="rounded-full brand-button px-4 py-2 text-sm font-semibold" onClick={handleConfirmContinue}>
            {confirming
              ? countdown > 0
                ? `Breathe ${countdown}s to continue`
                : `Continue for ${settings.extensionMinutes} more minutes`
              : `Continue mindfully (+${settings.extensionMinutes} min)`}
          </button>
          <button className="rounded-full border border-white/20 px-4 py-2 text-sm" onClick={onClose}>Done for now</button>
        </div>
      </div>
    </div>
  )
}

function SearchProfileResults({ profiles, searchQuery }) {
  if (!searchQuery || profiles.length === 0) return null

  return (
    <div className="fixed left-4 right-4 top-20 z-30 mx-auto max-w-2xl rounded-2xl bg-black/80 p-3 text-white shadow-2xl backdrop-blur lg:left-[300px] lg:right-[140px]">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Profiles matching “{searchQuery}”</p>
      <div className="flex gap-3 overflow-x-auto">
        {profiles.map((profile) => (
          <Link key={profile.id || profile.username} to={`/u/${profile.username}`} className="flex min-w-44 items-center gap-3 rounded-xl bg-white/10 p-2 hover:bg-white/15">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={`${profile.username} avatar`} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-olive)] text-sm font-black">
                {(profile.display_name || profile.username || '?')[0].toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{profile.display_name || profile.username}</span>
              <span className="block truncate text-xs text-white/55">@{profile.username}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function UsageOnboarding({ onSave }) {
  const [dailyLimitMinutes, setDailyLimitMinutes] = useState(60)
  const [videosPerSession, setVideosPerSession] = useState(10)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
      <div className="theme-card w-full max-w-lg rounded-2xl border p-4">
        <p className="text-lg font-semibold">Set your mindful defaults</p>
        <p className="mt-1 text-sm theme-muted">These are reminders, not hard locks. You can adjust anytime in Settings.</p>
        <label className="mt-3 block text-sm">
          Daily watch goal
          <select className="theme-input mt-1 w-full rounded-lg border p-2" value={dailyLimitMinutes} onChange={(e) => setDailyLimitMinutes(Number(e.target.value))}>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
          </select>
        </label>
        <label className="mt-3 block text-sm">
          Videos per session
          <select className="theme-input mt-1 w-full rounded-lg border p-2" value={videosPerSession} onChange={(e) => setVideosPerSession(Number(e.target.value))}>
            <option value={5}>5 videos</option>
            <option value={10}>10 videos</option>
            <option value={20}>20 videos</option>
          </select>
        </label>
        <button
          className="mt-4 w-full rounded-full brand-button px-4 py-2 font-semibold"
          onClick={() => onSave({ onboarded: true, dailyLimitMinutes, videosPerSession })}
        >
          Start with mindful defaults
        </button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [profileResults, setProfileResults] = useState([])
  const [followingProfiles, setFollowingProfiles] = useState([])
  const [loadError, setLoadError] = useState('')
  const [usageSettings, setUsageSettings] = useState(readUsageSettings)
  const [usageState, setUsageState] = useState(() => readUsageState(getDayString()))
  const [modalType, setModalType] = useState('')
  const [touchStart, setTouchStart] = useState(null)
  const containerRef = useRef(null)
  const tab = new URLSearchParams(location.search).get('tab') || 'for-you'
  const searchParams = new URLSearchParams(location.search)
  const searchQuery = searchParams.get('q') || ''
  const activityView = searchParams.get('view') || 'inbox'
  const dayKey = getDayString()

  const usageRatio = useMemo(() => {
    const total = usageSettings.dailyLimitMinutes + usageState.extraMinutes
    return total > 0 ? usageState.minutesUsed / total : 0
  }, [usageSettings.dailyLimitMinutes, usageState.extraMinutes, usageState.minutesUsed])

  useEffect(() => {
    let cancelled = false

    async function hydrateActivity() {
      const [followNotifications, followingData] = await Promise.all([
        user?.id ? fetchFollowNotifications(user.id) : Promise.resolve([]),
        user?.id ? fetchFollowingForUser(user.id) : Promise.resolve([]),
      ])

      if (cancelled) return
      setFeed([])
      setNotifications(followNotifications)
      setFollowingProfiles(followingData.map((entry) => ({
        id: entry.following_id,
        ...(entry.profiles || {}),
      })))
    }

    async function hydrateFeed() {
      const [browseData, profilesData] = await Promise.all([
        fetchContent({ search: searchQuery, category: 'all', feed: 'shorts' }),
        searchQuery.trim() ? fetchProfilesBySearch(searchQuery) : Promise.resolve([]),
      ])
      if (!cancelled) setProfileResults(profilesData)

      if (tab === 'following') {
        const followingIds = user?.id ? await fetchFollowingIds(user.id) : []
        const filtered = browseData.filter((item) => followingIds.includes(item.user_id))
        const avatarMap = await fetchProfileAvatarsByUserIds(filtered.map((item) => item.user_id))
        if (!cancelled) setFeed(filtered.map((item) => ({ ...item, avatar_url: avatarMap[item.user_id] || '' })))
        return
      }

      if (tab === 'explore') {
        const exploreOnly = browseData.filter((item) => item.username === 'uvideoexplore')
        const avatarMap = await fetchProfileAvatarsByUserIds(exploreOnly.map((item) => item.user_id))
        if (!cancelled) setFeed(exploreOnly.map((item) => ({ ...item, avatar_url: avatarMap[item.user_id] || '' })))
        return
      }

      const avatarMap = await fetchProfileAvatarsByUserIds(browseData.map((item) => item.user_id))
      if (!cancelled) setFeed(browseData.map((item) => ({ ...item, avatar_url: avatarMap[item.user_id] || '' })))
    }

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        if (tab === 'activity') {
          setProfileResults([])
          await hydrateActivity()
        } else {
          await hydrateFeed()
        }
        if (!cancelled) setActiveIndex(0)
      } catch (error) {
        console.error('Dashboard load failed:', error)
        if (!cancelled) {
          setFeed([])
          setLoadError('Unable to load right now. Pull to refresh or try again in a moment.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, tab, searchQuery])

  useEffect(() => {
    if (!containerRef.current || feed.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveIndex(Number(entry.target.dataset.feedIndex))
        })
      },
      { root: containerRef.current, threshold: 0.6 },
    )
    const children = containerRef.current.querySelectorAll('[data-feed-index]')
    children.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [feed])

  useEffect(() => {
    const activeItem = feed[activeIndex]
    if (!activeItem) return
    window.history.replaceState(null, '', `/video/${activeItem.id}`)
    const nextUsage = markVideoSeen(activeItem.id, dayKey)
    setTimeout(() => setUsageState(nextUsage), 0)
  }, [activeIndex, dayKey, feed])

  useEffect(() => {
    if (tab === 'activity' || feed.length === 0) return undefined
    const timer = setInterval(() => {
      const next = addUsageSeconds(5, dayKey)
      setUsageState(next)
    }, 5000)
    return () => clearInterval(timer)
  }, [dayKey, feed.length, tab])

  useEffect(() => {
    if (modalType) return
    if (!usageSettings.onboarded) return
    if (usageRatio >= 1 && !usageState.limitPromptShown) {
      setTimeout(() => setModalType('limit'), 0)
      acknowledgeLimit(dayKey)
      return
    }
    if (usageRatio >= 0.8 && !usageState.prompt80Shown) {
      setTimeout(() => setModalType('eighty'), 0)
      acknowledge80(dayKey)
      return
    }
    if (usageState.sessionVideos >= usageSettings.videosPerSession && usageState.sessionPromptShownAt !== usageState.sessionVideos) {
      setTimeout(() => setModalType('session'), 0)
      acknowledgeSessionPrompt(usageState.sessionVideos, dayKey)
    }
  }, [dayKey, modalType, usageRatio, usageSettings.onboarded, usageSettings.videosPerSession, usageState.limitPromptShown, usageState.prompt80Shown, usageState.sessionPromptShownAt, usageState.sessionVideos])

  function handleDeleted(id) {
    setFeed((prev) => prev.filter((item) => item.id !== id))
  }

  function updateMode(nextTab) {
    const params = new URLSearchParams(location.search)
    if (nextTab === 'for-you') params.delete('tab')
    else params.set('tab', nextTab)
    const query = params.toString()
    navigate(`/shorts${query ? `?${query}` : ''}`)
  }

  function cycleMode(direction) {
    const currentIndex = feedModes.indexOf(tab)
    if (currentIndex === -1) return
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= feedModes.length) return
    updateMode(feedModes[nextIndex])
  }

  function handleTouchStart(event) {
    const touch = event.changedTouches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }

  function handleTouchEnd(event) {
    if (!touchStart || tab === 'activity') return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - touchStart.x
    const dy = Math.abs(touch.clientY - touchStart.y)
    if (Math.abs(dx) < 60 || dy > 80) return
    if (dx < 0) cycleMode(1)
    else cycleMode(-1)
  }

  function handleContinue() {
    const next = addExtension(usageSettings.extensionMinutes, dayKey)
    setUsageState(next)
    setModalType('')
  }

  function handleTakeBreak() {
    const next = resetSession(dayKey)
    setUsageState(next)
    setModalType('')
  }

  function handleSaveOnboarding(nextSettings) {
    saveUsageSettings(nextSettings)
    setUsageSettings(readUsageSettings())
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 brand-spinner animate-spin" />
          <p className="text-[rgba(227,232,191,0.62)] text-sm">Loading feed…</p>
        </div>
      </div>
    )
  }

  if (tab === 'activity') {
    const storyProfiles = [
      ...(user ? [{
        id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'you',
        display_name: 'Create',
        avatar_url: user.user_metadata?.avatar_url || '',
        isCreate: true,
      }] : []),
      ...followingProfiles,
    ]
    const activityRows = [
      {
        id: 'subscribers',
        icon: '♟',
        title: 'New subscribers',
        body: notifications[0]?.profiles?.username
          ? `${notifications[0].profiles.username} subscribed to you.`
          : 'No new subscribers yet.',
      },
      {
        id: 'activity',
        icon: '♥',
        title: 'Activity',
        body: notifications.length
          ? `${notifications.length} recent subscription ${notifications.length === 1 ? 'notification' : 'notifications'}.`
          : 'Subscriber activity will appear here.',
      },
    ]
    const visibleNotifications = activityView === 'activity' || activityView === 'subscribers' || activityView === 'inbox' ? notifications : []

    return (
      <div className="theme-app-bg mx-auto max-w-2xl p-4 pt-20 lg:p-4">
        <section className="hidden theme-card rounded-2xl border p-4 lg:block">
          <h1 className="brand-accent-text text-2xl font-bold">Activity</h1>
          <p className="mt-1 text-sm theme-muted">Recent subscriptions</p>
          {loadError && <p className="mt-3 rounded-xl brand-error p-3 text-sm">{loadError}</p>}
          <div className="mt-4 space-y-3">
            {notifications.length === 0 && (
              <p className="text-sm theme-muted">No one has subscribed yet.</p>
            )}
            {notifications.map((notification) => (
              <div
                key={`${notification.follower_id}-${notification.created_at}`}
                className="rounded-xl border border-black/10 bg-black/10 p-3"
              >
                <p className="text-sm">
                  <span className="font-semibold">
                    @{notification.profiles?.username || 'user'}
                  </span>{' '}
                  subscribed to you.
                </p>
                <p className="mt-1 text-xs theme-muted">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="-mx-4 -mt-20 min-h-[calc(100dvh-4rem)] brand-surface-mobile pb-28 pt-20 lg:hidden">
          {loadError && <p className="mx-4 mb-4 rounded-xl brand-error p-3 text-sm">{loadError}</p>}
          <div className="flex gap-4 overflow-x-auto px-4 pb-5 pt-3" style={{ scrollbarWidth: 'none' }}>
            {storyProfiles.length === 0 ? (
              <div className="py-3 text-sm text-white/45">Subscribe to creators to see their updates here.</div>
            ) : storyProfiles.map((profile) => (
              <Link
                key={`${profile.isCreate ? 'create' : 'story'}-${profile.id || profile.username}`}
                to={profile.isCreate ? '/upload' : `/u/${profile.username}`}
                className="w-20 flex-none text-center"
              >
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--brand-sage)] bg-[var(--brand-olive)]">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username || 'profile'} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-white/70">{(profile.display_name || profile.username || '?')[0].toUpperCase()}</span>
                  )}
                  {profile.isCreate && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full brand-button text-xl font-black">+</span>}
                </div>
                <p className="mt-2 truncate text-xs font-bold">{profile.display_name || profile.username}</p>
              </Link>
            ))}
          </div>

          <div className="space-y-4 px-4">
            {activityRows.map((row) => (
              <Link
                key={row.id}
                to={`/shorts?tab=activity&view=${row.id}`}
                className={`flex items-center gap-3 rounded-2xl p-2 transition ${activityView === row.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${row.id === 'subscribers' ? 'brand-activity-icon' : 'brand-activity-icon-alt'} text-2xl`}>{row.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">{row.title}</p>
                  <p className="truncate text-base text-white/55">{row.body}</p>
                </div>
                <span className="text-xl text-white/35">›</span>
              </Link>
            ))}
          </div>

          {visibleNotifications.length > 0 && (
            <div className="mx-4 mt-5 space-y-3 rounded-2xl bg-white/5 p-3">
              {visibleNotifications.map((notification) => (
                <Link
                  key={`${notification.follower_id}-${notification.created_at}`}
                  to={notification.profiles?.username ? `/u/${notification.profiles.username}` : '/shorts?tab=activity'}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"
                >
                  {notification.profiles?.avatar_url ? (
                    <img src={notification.profiles.avatar_url} alt={notification.profiles?.username || 'profile'} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-olive)] text-sm font-bold">
                      {(notification.profiles?.display_name || notification.profiles?.username || '?')[0].toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">@{notification.profiles?.username || 'user'} subscribed to you.</p>
                    <p className="text-xs text-white/45">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] w-full flex-col items-center justify-center bg-[var(--brand-black)] text-[var(--brand-cream)] gap-4">
        <div className="text-4xl">📭</div>
        <SearchProfileResults profiles={profileResults} searchQuery={searchQuery} />
        {loadError && <p className="max-w-xs rounded-xl brand-error p-3 text-center text-sm">{loadError}</p>}
        <p className="max-w-xs text-center text-xl font-semibold">
          {tab === 'following'
            ? (searchQuery ? 'No matching posts from channels you subscribe to yet' : 'No posts from channels you subscribe to yet')
            : tab === 'explore'
              ? (searchQuery ? 'No matching explore posts yet from @uvideoexplore' : 'No explore posts yet from @uvideoexplore')
              : (searchQuery ? 'No videos matched your search' : 'No content yet')}
        </p>
        {tab === 'following' || tab === 'explore' ? (
          <Link to="/shorts" className="rounded-full brand-button px-6 py-2 font-semibold">
            Browse For You feed
          </Link>
        ) : (
          <Link to="/upload" className="rounded-full brand-button px-6 py-2 font-semibold">
            Upload the first video
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      <SearchProfileResults profiles={profileResults} searchQuery={searchQuery} />
      {!usageSettings.onboarded && <div className="hidden lg:block"><UsageOnboarding onSave={handleSaveOnboarding} /></div>}
      {modalType && (
        <div className="hidden lg:block">
        <MindfulModal
          type={modalType}
          settings={usageSettings}
          usage={usageState}
          onClose={() => setModalType('')}
          onTakeBreak={handleTakeBreak}
          onContinue={handleContinue}
        />
        </div>
      )}

      <div className="pointer-events-none fixed left-3 top-3 z-30 hidden rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur lg:block">
        {Math.round(usageState.minutesUsed)}m / {usageSettings.dailyLimitMinutes + usageState.extraMinutes}m
      </div>
      <button
        onClick={() => cycleMode(1)}
        className="fixed left-1/2 top-3 z-30 hidden -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur lg:block"
      >
        {tab === 'for-you' ? 'For You' : tab === 'following' ? 'Subscriptions' : 'Explore'} · Swipe ↔
      </button>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="h-[calc(100dvh-4rem)] overflow-y-scroll snap-y snap-mandatory bg-[var(--brand-black)]"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {feed.map((item, index) => (
          <div
            key={item.id}
            data-feed-index={index}
            className="h-[calc(100dvh-4rem)] w-full snap-start snap-always"
          >
            <FeedItem
              item={item}
              isActive={index === activeIndex}
              onDeleted={handleDeleted}
            />
          </div>
        ))}
      </div>
    </>
  )
}
