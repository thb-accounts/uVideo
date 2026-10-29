import { useEffect } from 'react'
import App from '../App'
import { useAuth } from '../context/useAuth'

export default function Startup() {
  const { loading } = useAuth()
  useEffect(() => {
    if (loading) return
    const frame = requestAnimationFrame(() => document.getElementById('mplace-startup')?.remove())
    return () => cancelAnimationFrame(frame)
  }, [loading])
  // Auth/network delays must not leave the public video catalogue hidden forever.
  useEffect(() => {
    const timeout = setTimeout(() => document.getElementById('mplace-startup')?.remove(), 8000)
    return () => clearTimeout(timeout)
  }, [])
  return <App />
}
