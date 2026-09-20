import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { useAuth } from '../context/useAuth'

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const paths = {
    menu: <path d="M4 6.5h16v1.8H4V6.5Zm0 4.6h16v1.8H4v-1.8Zm0 4.6h16v1.8H4v-1.8Z"/>,
    home: <path d="M12 3.4 3.5 10v10.5h6v-6h5v6h6V10L12 3.4Zm6.5 15.1h-2v-6h-9v6h-2V11L12 6l6.5 5v7.5Z"/>,
    blinks: <path d="M8 3.5v17l10-8.5L8 3.5Zm2 4.3 4.9 4.2-4.9 4.2V7.8Z"/>,
    upload: <path d="M11 17h2V9.8l2.6 2.6L17 11l-5-5-5 5 1.4 1.4L11 9.8V17ZM5 19h14v2H5v-2Z"/>,
    profile: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM4 21a8 8 0 0 1 16 0h-2a6 6 0 0 0-12 0H4Z"/>,
    settings: <path d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a8 8 0 0 0-1.8-1L14.7 3h-4l-.4 3a8 8 0 0 0-1.8 1L6 6 4 9.4 6 11a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2 1.6L6 18l2.5-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.5 1 2-3.4-2-1.6ZM12.7 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/>,
    search: <path d="M10.5 4a6.5 6.5 0 1 0 4 11.6l4.7 4.7 1.4-1.4-4.7-4.7A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>,
    back: <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z"/>,
  }
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">{paths[name]}</svg>
}

const navItems = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/blinks', label: 'Blinks', icon: 'blinks' },
  { to: '/upload', label: 'Create', icon: 'upload' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('search') || '')

  useEffect(() => { setQuery(new URLSearchParams(location.search).get('search') || '') }, [location.search])

  async function handleSignOut() { await signOut(); navigate('/') }
  function handleSearch(event) {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/?search=${encodeURIComponent(value)}` : '/')
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-[var(--app-border)] bg-white px-4 sm:px-6">
        <button onClick={() => setSidebarOpen(v => !v)} className="hidden h-10 w-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] lg:grid" aria-label="Toggle navigation"><Icon name="menu"/></button>
        <BrandLogo />
        <form onSubmit={handleSearch} className="mx-auto hidden w-full max-w-[720px] sm:block">
          <div className="flex h-12 w-full items-center rounded-full bg-[#f1f3f4] px-4 transition focus-within:bg-white focus-within:shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]">
            <Icon name="search" className="h-5 w-5 shrink-0 text-[#5f6368]"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search videos" className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-[#70757a]"/>
          </div>
        </form>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Link to="/upload" className="hidden h-10 items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 text-sm font-medium text-[#3c4043] hover:bg-[#f8f9fa] sm:flex"><Icon name="upload"/>Create</Link>
          <Link to={user ? '/profile' : '/auth'} className="ml-1 grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[#1f6f4a] text-sm font-medium text-white" title={user ? 'Your profile' : 'Sign in'}>{(user?.user_metadata?.username || user?.email || 'U')[0].toUpperCase()}</Link>
        </div>
      </header>

      <aside className={`fixed bottom-0 left-0 top-16 z-40 hidden bg-white transition-[width] duration-150 lg:flex lg:flex-col ${sidebarOpen ? 'w-64' : 'w-[72px]'}`}>
        <nav className="px-3 py-4" aria-label="Main navigation">
          {navItems.map(item => <NavLink key={item.label} to={item.to} end={item.to === '/'} className={({isActive})=>`mb-1 flex h-12 items-center rounded-full ${sidebarOpen?'gap-5 px-4':'justify-center'} ${isActive?'bg-[#e7f3ec] text-[#185c3d]':'text-[#3c4043] hover:bg-[#f1f3f4]'}`}><Icon name={item.icon}/>{sidebarOpen&&<span className="text-sm font-medium">{item.label}</span>}</NavLink>)}
          <div className="my-3 border-t border-[#e8eaed]"/>
          <NavLink to="/settings" className={({isActive})=>`mb-1 flex h-12 items-center rounded-full ${sidebarOpen?'gap-5 px-4':'justify-center'} ${isActive?'bg-[#e7f3ec] text-[#185c3d]':'text-[#3c4043] hover:bg-[#f1f3f4]'}`}><Icon name="settings"/>{sidebarOpen&&<span className="text-sm font-medium">Settings</span>}</NavLink>
          <a href="https://mplace.cc" className={`flex h-12 items-center rounded-full text-[#3c4043] hover:bg-[#f1f3f4] ${sidebarOpen?'gap-5 px-4':'justify-center'}`}><Icon name="back"/>{sidebarOpen&&<span className="text-sm font-medium">MPlace</span>}</a>
        </nav>
        {sidebarOpen&&user&&<button onClick={handleSignOut} className="mx-7 mb-6 mt-auto text-left text-sm font-medium text-[#1f6f4a]">Sign out</button>}
      </aside>

      <main className={`min-h-screen pb-20 pt-16 transition-[margin] duration-150 lg:pb-0 ${sidebarOpen?'lg:ml-64':'lg:ml-[72px]'}`}><Outlet/></main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-4 border-t border-[var(--app-border)] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile navigation">
        {[{to:'/',label:'Home',icon:'home'},{to:'/blinks',label:'Blinks',icon:'blinks'},{to:'/upload',label:'Create',icon:'upload'},{to:user?'/profile':'/auth',label:user?'You':'Sign in',icon:'profile'}].map(item=><NavLink key={item.label} to={item.to} end={item.to==='/' } className={({isActive})=>`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive?'text-[#185c3d]':'text-[#5f6368]'}`}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}
      </nav>
    </div>
  )
}
