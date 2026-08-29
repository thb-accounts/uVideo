import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { useAuth } from '../context/useAuth'

const Icon = ({ name }) => {
  const paths = {
    menu: <path d="M4 7h16v2H4V7Zm0 4h16v2H4v-2Zm0 4h16v2H4v-2Z" />,
    home: <path d="M3 11.2 12 4l9 7.2V21h-6v-6H9v6H3v-9.8Z" />,
    blinks: <path d="m9 3 8 4-5 3 5 3-8 8-2-7 5-3-5-3 2-5Z" />,
    upload: <path d="M11 16V8.8L8.4 11.4 7 10l5-5 5 5-1.4 1.4L13 8.8V16h-2ZM5 19v-2h14v2H5Z" />,
    profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" />,
    settings: <path d="m9.5 3 .5 2a7 7 0 0 1 4 0l.5-2 3 1.7-.9 1.8a7 7 0 0 1 2 3.5l2 .2v3.5l-2 .3a7 7 0 0 1-2 3.5l.9 1.8-3 1.7-.5-2a7 7 0 0 1-4 0l-.5 2-3-1.7.9-1.8a7 7 0 0 1-2-3.5l-2-.3v-3.5l2-.2a7 7 0 0 1 2-3.5l-.9-1.8L9.5 3ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
    search: <path d="m20 19-4.1-4.1a7 7 0 1 0-1.4 1.4L18.6 20 20 19ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />,
    back: <path d="m14.7 6.7-1.4-1.4L6.6 12l6.7 6.7 1.4-1.4L9.4 12l5.3-5.3Z" />,
  }
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">{paths[name]}</svg>
}

const navItems = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/blinks', label: 'Blinks', icon: 'blinks' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('search') || '')

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  function handleSearch(event) {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/?search=${encodeURIComponent(value)}` : '/')
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-[var(--app-border)] bg-white/94 px-3 backdrop-blur-[18px] sm:px-5">
        <button onClick={() => setSidebarOpen((value) => !value)} className="hidden h-11 w-11 place-items-center rounded-[13px] border border-[var(--app-border)] bg-white text-[var(--app-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] lg:grid" aria-label="Toggle sidebar"><Icon name="menu" /></button>
        <BrandLogo />
        <form onSubmit={handleSearch} className="mx-auto hidden w-full max-w-2xl items-center sm:flex">
          <div className="flex w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white shadow-sm focus-within:border-[#72aa8d] focus-within:ring-2 focus-within:ring-[#e5f3eb]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search MPlace Videos" className="min-w-0 flex-1 bg-transparent px-5 py-2.5 text-sm outline-none placeholder:text-[var(--app-muted)]" />
            <button className="grid w-14 place-items-center border-l border-[var(--app-border)] bg-[var(--app-muted-bg)] text-[var(--app-muted)] hover:text-[#126341]" aria-label="Search"><Icon name="search" /></button>
          </div>
        </form>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Link to="/upload" className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#126341] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f5739] sm:flex"><Icon name="upload" /> Create</Link>
          <Link to={user ? '/profile' : '/auth'} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#126341] text-sm font-black text-white shadow-sm" title={user ? 'Your channel' : 'Sign in'}>{(user?.user_metadata?.username || user?.email || 'U')[0].toUpperCase()}</Link>
        </div>
      </header>

      <aside className={`fixed bottom-0 left-0 top-16 z-40 hidden border-r border-[var(--app-border)] bg-white transition-[width] duration-200 lg:flex lg:flex-col ${sidebarOpen ? 'w-60' : 'w-[76px]'}`}>
        <nav className="p-3" aria-label="Main navigation">
          {navItems.map((item) => <NavLink key={item.label} to={item.to} end={item.to === '/'} className={({ isActive }) => `mb-1 flex min-h-11 items-center rounded-xl transition ${sidebarOpen ? 'gap-4 px-3' : 'justify-center px-2'} ${isActive ? 'bg-[#e8f4ed] text-[#126341]' : 'text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]'}`}><Icon name={item.icon} />{sidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}</NavLink>)}
          {sidebarOpen && <div className="my-3 border-t border-[var(--app-border)]" />}
          <a href="https://mplace.cc" className={`mb-1 flex min-h-11 items-center rounded-xl text-[var(--app-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] ${sidebarOpen ? 'gap-4 px-3' : 'justify-center px-2'}`}><Icon name="back" />{sidebarOpen && <span className="text-sm font-semibold">Back to MPlace</span>}</a>
          <NavLink to="/settings" className={({ isActive }) => `flex min-h-11 items-center rounded-xl transition ${sidebarOpen ? 'gap-4 px-3' : 'justify-center px-2'} ${isActive ? 'bg-[#e8f4ed] text-[#126341]' : 'text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]'}`}><Icon name="settings" />{sidebarOpen && <span className="text-sm font-semibold">Settings</span>}</NavLink>
        </nav>
        {sidebarOpen && <div className="mt-auto border-t border-[var(--app-border)] p-5 text-xs leading-5 text-[var(--app-muted)]"><p><strong className="text-[var(--app-text)]">MPlace Videos</strong><br />Videos, creators and Blinks in one cleaner place.</p>{user && <button onClick={handleSignOut} className="mt-3 font-semibold text-[#126341]">Sign out</button>}</div>}
      </aside>

      <main className={`min-h-screen pb-20 pt-16 transition-[margin] duration-200 lg:pb-0 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-[76px]'}`}><Outlet /></main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-[68px] grid-cols-4 border-t border-[var(--app-border)] bg-white/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-[18px] lg:hidden" aria-label="Mobile navigation">
        {[{ to: '/', label: 'Home', icon: 'home' },{ to: '/blinks', label: 'Blinks', icon: 'blinks' },{ to: '/upload', label: 'Create', icon: 'upload' },{ to: user ? '/profile' : '/auth', label: user ? 'You' : 'Sign in', icon: 'profile' }].map((item) => <NavLink key={item.label} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive ? 'text-[#126341]' : 'text-[var(--app-muted)]'}`}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
      </nav>
    </div>
  )
}
