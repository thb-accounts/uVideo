import { useEffect, useState } from 'react'
import { autoDownloadsEnabled, getOfflineItems, getPendingDownloadIds, reconcileOfflineItems } from '../lib/offlineStore'

function snapshot() {
  return { items: getOfflineItems(), pending: getPendingDownloadIds(), automatic: autoDownloadsEnabled() }
}
export function useOfflineLibrary() {
  const [library, setLibrary] = useState(snapshot)
  useEffect(() => {
    const refresh = () => setLibrary(snapshot())
    window.addEventListener('mplace-offline-changed', refresh)
    window.addEventListener('storage', refresh)
    reconcileOfflineItems().catch(() => {})
    return () => {
      window.removeEventListener('mplace-offline-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return library
}
