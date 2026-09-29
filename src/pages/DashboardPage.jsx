import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { fetchContent, fetchProfileAvatarsByUserIds } from '../lib/contentApi'
import FeedItem from '../components/FeedItem'
import { prefetchBlinks } from '../lib/offlineStore'

const feedModes = ['for-you', 'explore']

export default function DashboardPage({ mobileOnly = false }) {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [touchStart, setTouchStart] = useState(null)
  const containerRef = useRef(null)
  const tab = mobileOnly ? 'for-you' : new URLSearchParams(location.search).get('tab') || 'for-you'
  useEffect(() => {
    let cancelled = false

    async function hydrateFeed() {
      const browseData = await fetchContent({ category: 'all', feed: 'shorts' })

      if (tab === 'explore') {
        const exploreOnly = browseData.filter((item) => item.username === 'MVideoexplore')
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
    if (!navigator.onLine || feed.length === 0) return
    prefetchBlinks(feed.slice(activeIndex, activeIndex + 12))
  }, [activeIndex, feed])

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
    if (!mobileOnly) window.history.replaceState(null, '', `/video/${activeItem.id}`)
  }, [activeIndex, feed, mobileOnly])

  function handleDeleted(id) {
    setFeed((prev) => prev.filter((item) => item.id !== id))
  }

  function updateMode(nextTab) {
    const params = new URLSearchParams(location.search)
    if (nextTab === 'for-you') params.delete('tab')
    else params.set('tab', nextTab)
    const query = params.toString()
    if (!mobileOnly) navigate(`/blinks${query ? `?${query}` : ''}`)
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
    if (mobileOnly) return
    if (dx < 0) cycleMode(1)
    else cycleMode(-1)
  }

  if (loading) {
    return (
      <div className={`flex ${mobileOnly ? 'h-dvh' : 'h-[calc(100dvh-4rem)]'} w-full items-center justify-center bg-black`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 brand-spinner animate-spin" />
          <p className="text-[rgba(227,232,191,0.62)] text-sm">Loading feed…</p>
        </div>
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className={`flex ${mobileOnly ? 'h-dvh' : 'h-[calc(100dvh-4rem)]'} w-full flex-col items-center justify-center bg-[var(--brand-black)] text-[var(--brand-cream)] gap-4`}>
        <div className="text-4xl">📭</div>
        {loadError && <p className="max-w-xs rounded-xl brand-error p-3 text-center text-sm">{loadError}</p>}
        <p className="max-w-xs text-center text-xl font-semibold">
          {tab === 'explore' ? 'No explore posts yet from @MVideoexplore' : 'No content yet'}
        </p>
        {tab === 'explore' ? (
          <Link to="/blinks" className="rounded-full brand-button px-6 py-2 font-semibold">
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
      {!mobileOnly && <button
        onClick={() => cycleMode(1)}
        className="fixed left-1/2 top-3 z-30 hidden -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur lg:block"
      >
        {tab === 'for-you' ? 'For You' : 'Explore'} · Swipe ↔
      </button>}

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`${mobileOnly ? 'h-dvh lg:hidden' : 'h-[calc(100dvh-4rem)]'} overflow-y-scroll snap-y snap-mandatory bg-[var(--brand-black)]`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {feed.map((item, index) => (
          <div
            key={item.id}
            data-feed-index={index}
            className={`${mobileOnly ? 'h-dvh' : 'h-[calc(100dvh-4rem)]'} w-full snap-start snap-always`}
          >
            <FeedItem
              item={item}
              isActive={index === activeIndex}
              onDeleted={handleDeleted}
              immersive={mobileOnly}
            />
          </div>
        ))}
      </div>
      {mobileOnly && (
        <div className="hidden h-dvh items-center justify-center bg-black px-6 text-center text-white lg:flex">
          <div>
            <p className="text-2xl font-bold">Blinks is mobile-only</p>
            <p className="mt-2 text-sm text-white/60">Open this page on a phone-sized screen to scroll through videos.</p>
          </div>
        </div>
      )}
    </>
  )
}
