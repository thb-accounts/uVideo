import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchContent,
  fetchProfileAvatarsByUserIds,
} from '../lib/contentApi'
import FeedItem from '../components/FeedItem'
import {
  acknowledge80,
  acknowledgeLimit,
  acknowledgeSessionPrompt,
  addExtension,
  applyGuestCode,
  addUsageSeconds,
  getDayString,
  getGuestAllowedMinutes,
  markVideoSeen,
  readUsageSettings,
  readUsageState,
  resetSession,
  saveUsageSettings,
} from '../lib/usageLimits'

const feedModes = ['for-you', 'explore']

function MindfulModal({
  type,
  settings,
  usage,
  onClose,
  onTakeBreak,
  onContinue,
  isGuestLocked = false,
  onApplyCode,
}) {
  const [confirming, setConfirming] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [code, setCode] = useState('')
  const [codeMessage, setCodeMessage] = useState('')

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
    type === 'guest-limit'
      ? `Guests can watch Slims for ${settings.dailyLimitMinutes} minutes today. Enter a code ending or starting with IB1, AP14, or QB2 to unlock more time.`
      : type === 'eighty'
        ? `Today: ${Math.round(usage.minutesUsed)} / ${settings.dailyLimitMinutes} minutes.`
        : type === 'session'
          ? `You watched ${usage.sessionVideos} videos in this session.`
          : `Today: ${Math.round(usage.minutesUsed)} / ${settings.dailyLimitMinutes + usage.extraMinutes} minutes.`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="theme-card w-full max-w-md rounded-2xl border p-4" onClick={(event) => event.stopPropagation()}>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm theme-muted">{body}</p>
        {isGuestLocked ? (
          <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); const result = onApplyCode(code); setCodeMessage(result.message) }}>
            <input className="theme-input rounded-xl border px-3 py-2 text-sm" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter time code" />
            {codeMessage && <p className="text-xs theme-muted">{codeMessage}</p>}
            <button className="rounded-full brand-button px-4 py-2 text-sm font-semibold" type="submit">Apply code</button>
            <Link className="rounded-full border border-white/20 px-4 py-2 text-center text-sm" to="/auth">Sign in for unrestricted Slims</Link>
          </form>
        ) : (
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
        )}
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
  const [loadError, setLoadError] = useState('')
  const [usageSettings, setUsageSettings] = useState(readUsageSettings)
  const [usageState, setUsageState] = useState(() => readUsageState(getDayString()))
  const [modalType, setModalType] = useState('')
  const [touchStart, setTouchStart] = useState(null)
  const containerRef = useRef(null)
  const tab = new URLSearchParams(location.search).get('tab') || 'for-you'
  const dayKey = getDayString()
  const isGuest = !user
  const guestLimitMinutes = getGuestAllowedMinutes(dayKey)
  const effectiveDailyLimit = isGuest ? guestLimitMinutes : usageSettings.dailyLimitMinutes

  const usageRatio = useMemo(() => {
    const total = effectiveDailyLimit + (isGuest ? 0 : usageState.extraMinutes)
    return total > 0 ? usageState.minutesUsed / total : 0
  }, [effectiveDailyLimit, isGuest, usageState.extraMinutes, usageState.minutesUsed])

  useEffect(() => {
    let cancelled = false

    async function hydrateFeed() {
      const browseData = await fetchContent({ category: 'all', feed: 'shorts' })

      if (tab === 'explore') {
        const exploreOnly = browseData.filter((item) => item.username === 'simplichillexplore')
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
        await hydrateFeed()
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
  }, [tab])

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
    if (feed.length === 0 || modalType === 'guest-limit') return undefined
    const timer = setInterval(() => {
      const next = addUsageSeconds(5, dayKey)
      setUsageState(next)
    }, 5000)
    return () => clearInterval(timer)
  }, [dayKey, feed.length, modalType, tab])

  useEffect(() => {
    if (modalType) return
    if (isGuest && usageRatio >= 1) {
      setTimeout(() => setModalType('guest-limit'), 0)
      return
    }
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
  }, [dayKey, isGuest, modalType, usageRatio, usageSettings.onboarded, usageSettings.videosPerSession, usageState.limitPromptShown, usageState.prompt80Shown, usageState.sessionPromptShownAt, usageState.sessionVideos])

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
    if (!touchStart) return
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

  function handleApplyCode(code) {
    const result = applyGuestCode(code, dayKey)
    if (!result.ok) return { message: result.message }
    setUsageSettings((current) => ({ ...current }))
    setModalType('')
    return { message: `${result.grant.token} accepted. You now have ${result.grant.minutes} minutes today.` }
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

  if (feed.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] w-full flex-col items-center justify-center bg-[var(--brand-black)] text-[var(--brand-cream)] gap-4">
        <div className="text-4xl">📭</div>
        {loadError && <p className="max-w-xs rounded-xl brand-error p-3 text-center text-sm">{loadError}</p>}
        <p className="max-w-xs text-center text-xl font-semibold">
          {tab === 'explore' ? 'No explore posts yet from @simplichillexplore' : 'No content yet'}
        </p>
        {tab === 'explore' ? (
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
      {!usageSettings.onboarded && <div className="hidden lg:block"><UsageOnboarding onSave={handleSaveOnboarding} /></div>}
      {modalType && (
        <div>
        <MindfulModal
          type={modalType}
          settings={{ ...usageSettings, dailyLimitMinutes: effectiveDailyLimit }}
          usage={usageState}
          onClose={() => setModalType('')}
          onTakeBreak={handleTakeBreak}
          onContinue={handleContinue}
          isGuestLocked={modalType === 'guest-limit'}
          onApplyCode={handleApplyCode}
        />
        </div>
      )}

      <div className="pointer-events-none fixed left-3 top-3 z-30 hidden rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur lg:block">
        {Math.round(usageState.minutesUsed)}m / {effectiveDailyLimit + (isGuest ? 0 : usageState.extraMinutes)}m
      </div>
      <button
        onClick={() => cycleMode(1)}
        className="fixed left-1/2 top-3 z-30 hidden -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur lg:block"
      >
        {tab === 'for-you' ? 'For You' : 'Explore'} · Swipe ↔
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
              forcePaused={modalType === 'guest-limit'}
            />
          </div>
        ))}
      </div>
    </>
  )
}
