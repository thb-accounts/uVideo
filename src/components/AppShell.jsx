import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { useAuth } from '../context/useAuth'

const Icon = ({ name }) => {
  const paths = {
    home: <path d="M3 11.2 12 4l9 7.2V21h-6v-6H9v6H3v-9.8Z" />,
    math: <path d="M4 5h16v14H4V5Zm3 3v2h4V8H7Zm0 5v2h2v-2H7Zm5 0v2h5v-2h-5Z" />,
    tutorials: <path d="M4 5h16v12H8l-4 3V5Zm4 3v2h8V8H8Zm0 4v2h5v-2H8Z" />,
    shorts: <path d="m9 3 8 4-5 3 5 3-8 8-2-7 5-3-5-3 2-5Z" />,
    subscriptions: <path d="M5 5h14v3H5V5Zm-2 5h18v10H3V10Zm7 2.5v5l5-2.5-5-2.5Z" />,
    upload: <path d="M11 16V8.8L8.4 11.4 7 10l5-5 5 5-1.4 1.4L13 8.8V16h-2ZM5 19v-2h14v2H5Z" />,
    profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" />,
    settings: <path d="m9.5 3 .5 2a7 7 0 0 1 4 0l.5-2 3 1.7-.9 1.8a7 7 0 0 1 2 3.5l2 .2v3.5l-2 .3a7 7 0 0 1-2 3.5l.9 1.8-3 1.7-.5-2a7 7 0 0 1-4 0l-.5 2-3-1.7.9-1.8a7 7 0 0 1-2-3.5l-2-.3v-3.5l2-.2a7 7 0 0 1 2-3.5l-.9-1.8L9.5 3ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  }
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">{paths[name]}</svg>
}

const navigation = [
  { to: '/', label: 'Home', icon: 'home' },
  { href: 'https://mathart.unrealcake8.site', label: 'MathArt', icon: 'math' },
  { to: '/?category=Tutorials', label: 'Tutorials', icon: 'tutorials' },
  { to: '/shorts', label: 'Shorts', icon: 'shorts' },
  { to: '/shorts?tab=following', label: 'Subscriptions', icon: 'subscriptions' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const [searchText, setSearchText] = useState(params.get('q') || '')

  useEffect(() => {
    setSearchText(new URLSearchParams(location.search).get('q') || '')
  }, [location.search])

  function handleSearch(event) {
    event.preventDefault()
    const query = searchText.trim()
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-white">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-white/10 bg-[#0f0f0f]/95 px-4 backdrop-blur-xl sm:gap-6 lg:px-6">
        <BrandLogo />
        <form onSubmit={handleSearch} className="mx-auto flex w-full max-w-2xl items-center">
          <label htmlFor="uvideo-search" className="sr-only">Search UVideo</label>
          <input
            id="uvideo-search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search UVideo"
            className="h-10 min-w-0 flex-1 rounded-l-full border border-white/15 bg-[#121212] px-4 text-sm text-white outline-none transition placeholder:text-[#888] focus:border-[#3ea6ff]"
          />
          <button className="grid h-10 w-12 place-items-center rounded-r-full border border-l-0 border-white/15 bg-[#222] text-[#ddd] transition hover:bg-[#303030]" aria-label="Search">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
          </button>
        </form>
        <Link to="/upload" className="hidden h-10 items-center gap-2 rounded-full bg-[#272727] px-4 text-sm font-bold transition hover:bg-[#3a3a3a] sm:flex">
          <Icon name="upload" /> Upload
        </Link>
        <Link to={user ? '/profile' : '/auth'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3ea6ff] to-[#00c8ff] text-sm font-black text-[#06121a]" title={user ? 'Profile' : 'Sign in'}>
          {(user?.user_metadata?.username || user?.email || 'U')[0].toUpperCase()}
        </Link>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-60 flex-col border-r border-white/10 bg-[#0f0f0f] p-3 lg:flex">
        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map((item) => item.href ? (
            <a key={item.label} href={item.href} className="flex items-center gap-4 rounded-xl px-3 py-2.5 text-sm font-medium text-[#ddd] transition hover:bg-[#272727] hover:text-white">
              <Icon name={item.icon} /> {item.label}
            </a>
          ) : (
            <NavLink key={item.label} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex items-center gap-4 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-[#272727] text-white' : 'text-[#ddd] hover:bg-[#272727] hover:text-white'}`}>
              <Icon name={item.icon} /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-3 text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Partners</p>
          <a href="https://mathart.unrealcake8.site/tips/" className="mt-2 block rounded-xl px-3 py-2 text-sm text-[#aaa] hover:bg-[#272727] hover:text-white">MathArt Tips ↗</a>
        </div>
        <div className="mt-auto border-t border-white/10 px-3 pt-4">
          <p className="text-xs leading-relaxed text-[#777]">Videos for creators, coders, and MathArt makers.</p>
          {user ? (
            <button onClick={handleSignOut} className="mt-3 text-xs font-semibold text-[#aaa] hover:text-white">Sign out</button>
          ) : (
            <Link to="/auth" className="mt-3 inline-block rounded-full border border-[#3ea6ff] px-4 py-2 text-xs font-bold text-[#3ea6ff] hover:bg-[#3ea6ff]/10">Sign in</Link>
          )}
        </div>
      </aside>

      <main className="min-h-screen pb-20 pt-16 lg:ml-60 lg:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-white/10 bg-[#0f0f0f]/98 lg:hidden" aria-label="Mobile navigation">
        {navigation.filter((item) => ['Home', 'Shorts', 'Upload', 'Profile', 'Settings'].includes(item.label)).map((item) => (
          <NavLink key={item.label} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] ${isActive ? 'text-[#3ea6ff]' : 'text-[#aaa]'}`}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
