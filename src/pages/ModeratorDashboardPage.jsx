import { useCallback, useEffect, useMemo, useState } from 'react'
import { addUserStrike, fetchModeratorQueue, fetchProfilesByIds, fetchReports, getProfile, updateContentModeration, updateReportStatus } from '../lib/contentApi'
import { useAuth } from '../context/useAuth'

const statusOptions = ['all', 'published', 'removed', 'rejected', 'needs_review', 'pending_review']

export default function ModeratorDashboardPage() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(false)
  const [queue, setQueue] = useState([])
  const [reports, setReports] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [showOnlyActionItems, setShowOnlyActionItems] = useState(true)
  const [filters, setFilters] = useState({ status: 'all', target_type: 'all', report_status: 'open' })

  const load = useCallback(async () => {
    const [q, r] = await Promise.all([
      fetchModeratorQueue({ status: filters.status === 'all' ? undefined : filters.status }),
      fetchReports({ status: filters.report_status === 'all' ? undefined : filters.report_status, target_type: filters.target_type === 'all' ? undefined : filters.target_type }),
    ])
    const ids = [...new Set([...q.map((i) => i.user_id), ...r.map((i) => i.reporter_id), ...r.map((i) => i.target_user_id)].filter(Boolean))]
    const profiles = await fetchProfilesByIds(ids)
    setProfileMap(profiles)
    setQueue(q)
    setReports(r)
  }, [filters.report_status, filters.status, filters.target_type])

  useEffect(() => {
    async function init() {
      if (!user?.id) return
      const profile = await getProfile(user.id)
      setAllowed(profile?.role === 'moderator' || profile?.role === 'admin')
    }
    init()
  }, [user?.id])

  useEffect(() => { if (allowed) load() }, [allowed, load])

  const actionableQueue = useMemo(() => queue.filter((item) => item.status !== 'published'), [queue])
  const visibleQueue = showOnlyActionItems ? actionableQueue : queue
  const openReports = useMemo(() => reports.filter((r) => r.status === 'open'), [reports])

  if (!allowed) return <div className="p-6">Moderator/admin access only.</div>

  return <div className="p-4 space-y-4">
    <h1 className="text-2xl font-bold">Community management workspace</h1>
    <p className="text-sm theme-muted">Designed for non-programmers: pick a filter, review a case, and click a plain-language action.</p>

    <div className="theme-card border rounded p-3 grid md:grid-cols-4 gap-3">
      <label className="text-sm">Post status
        <select className="theme-input rounded border p-2 w-full mt-1" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>
      <label className="text-sm">Report status
        <select className="theme-input rounded border p-2 w-full mt-1" value={filters.report_status} onChange={(e) => setFilters((f) => ({ ...f, report_status: e.target.value }))}>{['all', 'open', 'resolved', 'dismissed'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>
      <label className="text-sm">Report type
        <select className="theme-input rounded border p-2 w-full mt-1" value={filters.target_type} onChange={(e) => setFilters((f) => ({ ...f, target_type: e.target.value }))}>{['all', 'content', 'comment'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>
      <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={showOnlyActionItems} onChange={(e) => setShowOnlyActionItems(e.target.checked)} />Only show items that need action</label>
    </div>

    <div className="grid md:grid-cols-3 gap-3">
      <div className="theme-card border rounded p-3"><p className="text-sm theme-muted">Posts needing review</p><p className="text-2xl font-bold">{actionableQueue.length}</p></div>
      <div className="theme-card border rounded p-3"><p className="text-sm theme-muted">Open reports</p><p className="text-2xl font-bold">{openReports.length}</p></div>
      <div className="theme-card border rounded p-3"><p className="text-sm theme-muted">Total queue items</p><p className="text-2xl font-bold">{queue.length}</p></div>
    </div>

    <h2 className="font-semibold">Post actions</h2>
    {visibleQueue.map((item) => {
      const owner = profileMap[item.user_id]
      return <div key={item.id} className="theme-card border rounded p-3">
        <p className="font-semibold">{item.title || 'Untitled post'}</p>
        <p className="text-sm theme-muted">Current status: {item.status || 'published'}</p>
        <p className="text-sm">Posted by: @{owner?.username || item.username || 'unknown'} · {owner?.email || 'email unavailable'}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <button className="px-3 py-1 border rounded" onClick={() => updateContentModeration(item.id, { status: 'published', reviewed_at: new Date().toISOString() }).then(load)}>Keep post live</button>
          <button className="px-3 py-1 border rounded" onClick={() => updateContentModeration(item.id, { status: 'removed', reviewed_at: new Date().toISOString() }).then(load)}>Remove from feed</button>
          <button className="px-3 py-1 border rounded" onClick={() => updateContentModeration(item.id, { status: 'rejected', reviewed_at: new Date().toISOString() }).then(load)}>Reject post</button>
        </div>
      </div>
    })}

    <h2 className="font-semibold">User reports</h2>
    {reports.map((r) => {
      const reporter = profileMap[r.reporter_id]
      const target = profileMap[r.target_user_id]
      return <div key={r.id} className="theme-card border rounded p-3">
        <p className="font-semibold">{r.target_type} report · {r.reason}</p>
        <p className="text-sm">Reporter: {r.reporter_email || reporter?.email || 'email unavailable'}</p>
        <p className="text-sm">Target user: {r.target_user_email || target?.email || 'email unavailable'}</p>
        <p className="text-sm theme-muted">{r.details || 'No details provided.'}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <button className="px-3 py-1 border rounded" onClick={() => updateReportStatus(r.id, 'dismissed').then(load)}>No violation (dismiss)</button>
          <button className="px-3 py-1 border rounded" onClick={() => addUserStrike({ user_id: r.target_user_id, notes: 'Report strike from moderation workspace' }).then(() => updateReportStatus(r.id, 'resolved')).then(load)}>Warn user + resolve</button>
        </div>
      </div>
    })}
  </div>
}
