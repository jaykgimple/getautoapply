'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface TrackedApp {
  id: string
  job_title: string
  company_name: string
  job_url: string
  status: string
  applied_date: string
  next_followup_date: string
  followup_count: number
  notes: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  saved:     { label: '💾 Saved', color: '#9ca3af' },
  applied:   { label: '📤 Applied', color: '#5e6ad2' },
  screening: { label: '📋 Screening', color: '#a855f7' },
  interview: { label: '🎤 Interview', color: '#eab308' },
  offer:     { label: '🎉 Offer', color: '#22c55e' },
  rejected:  { label: '❌ Rejected', color: '#ef4444' },
  ghosted:   { label: '👻 Ghosted', color: '#6b7280' },
  withdrawn: { label: '🚫 Withdrawn', color: '#6b7280' },
}

export default function TrackerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [tracked, setTracked] = useState<TrackedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEntry, setNewEntry] = useState({ job_title: '', company_name: '', job_url: '', status: 'saved', notes: '' })
  const [filter, setFilter] = useState<string>('all')

  const loadTracked = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('application_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTracked(data || [])
  }, [userId])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push('/login'); return }
      setUserId(session.user.id)
      loadTracked().then(() => setLoading(false))
    })
  }, [])

  const addEntry = async () => {
    if (!newEntry.job_title || !newEntry.company_name) return
    await supabase.from('application_tracking').insert({
      user_id: userId,
      job_title: newEntry.job_title,
      company_name: newEntry.company_name,
      job_url: newEntry.job_url,
      status: newEntry.status,
      notes: newEntry.notes,
      applied_date: newEntry.status === 'applied' ? new Date().toISOString() : null,
    })
    setNewEntry({ job_title: '', company_name: '', job_url: '', status: 'saved', notes: '' })
    setShowAddModal(false)
    loadTracked()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('application_tracking').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadTracked()
  }

  const markFollowup = async (id: string) => {
    const entry = tracked.find(t => t.id === id)
    if (!entry) return
    const count = entry.followup_count + 1
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + (count === 1 ? 3 : count === 2 ? 7 : 14))
    await supabase.from('application_tracking').update({
      followup_count: count,
      next_followup_date: nextDate.toISOString(),
      last_response_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadTracked()
  }

  const deleteEntry = async (id: string) => {
    await supabase.from('application_tracking').delete().eq('id', id)
    loadTracked()
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>

  const filtered = filter === 'all' ? tracked : tracked.filter(t => t.status === filter)
  const stats = {
    total: tracked.length,
    applied: tracked.filter(t => t.status === 'applied').length,
    interviews: tracked.filter(t => t.status === 'interview').length,
    offers: tracked.filter(t => t.status === 'offer').length,
    ghosted: tracked.filter(t => t.status === 'ghosted').length,
    needFollowup: tracked.filter(t => {
      if (!t.next_followup_date) return false
      return new Date(t.next_followup_date) <= new Date() && ['applied', 'screening'].includes(t.status)
    }).length,
  }

  const bg = 'var(--bg-base)'
  const card = 'var(--bg-elevated)'
  const text = 'var(--text-primary)'
  const muted = 'var(--text-secondary)'
  const border = 'var(--border)'
  const brand = 'var(--brand)'

  return (
    <div className="min-h-screen" style={{ background: bg, color: text }}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Application Tracker</h1>
            <p className="text-sm mt-1" style={{ color: muted }}>Beat the black hole — track, follow up, get responses</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: brand, color: '#000' }}>
            + Track Application
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: text },
            { label: 'Applied', value: stats.applied, color: '#5e6ad2' },
            { label: 'Interviews', value: stats.interviews, color: '#eab308' },
            { label: 'Offers', value: stats.offers, color: '#22c55e' },
            { label: 'Ghosted', value: stats.ghosted, color: '#6b7280' },
            { label: 'Need Follow-up', value: stats.needFollowup, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: card, border: `1px solid ${border}` }}>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: muted }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilter('all')} className="px-3 py-1 rounded text-xs font-medium" style={{ background: filter === 'all' ? brand : card, color: filter === 'all' ? '#000' : text, border: `1px solid ${border}` }}>All</button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setFilter(key)} className="px-3 py-1 rounded text-xs font-medium" style={{ background: filter === key ? brand : card, color: filter === key ? '#000' : text, border: `1px solid ${border}` }}>{cfg.label}</button>
          ))}
        </div>

        {/* Applications list */}
        {filtered.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: card, border: `1px solid ${border}` }}>
            <p className="text-lg mb-2">📋 No applications tracked yet</p>
            <p className="text-sm" style={{ color: muted }}>Start tracking your applications to beat the black hole effect</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => {
              const cfg = STATUS_CONFIG[app.status] || { label: app.status, color: '#9ca3af' }
              const needsFollowup = app.next_followup_date && new Date(app.next_followup_date) <= new Date() && ['applied', 'screening'].includes(app.status)
              return (
                <div key={app.id} className="rounded-xl p-4" style={{ background: card, border: `1px solid ${needsFollowup ? '#ef4444' : border}` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{app.job_title}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: cfg.color + '20', color: cfg.color }}>{cfg.label}</span>
                        {needsFollowup && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: '#ef444420', color: '#ef4444' }}>⏰ Follow up!</span>}
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: muted }}>{app.company_name}</p>
                      {app.notes && <p className="text-xs mt-1" style={{ color: muted }}>{app.notes}</p>}
                      <div className="flex gap-3 mt-2 text-xs" style={{ color: muted }}>
                        {app.applied_date && <span>Applied: {new Date(app.applied_date).toLocaleDateString()}</span>}
                        {app.followup_count > 0 && <span>Follow-ups: {app.followup_count}</span>}
                        {app.next_followup_date && <span>Next: {new Date(app.next_followup_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <select value={app.status} onChange={e => updateStatus(app.id, e.target.value)}
                        className="px-2 py-1 rounded text-xs" style={{ background: bg, border: `1px solid ${border}`, color: text }}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      {['applied', 'screening'].includes(app.status) && (
                        <button onClick={() => markFollowup(app.id)} className="px-2 py-1 rounded text-xs" style={{ background: '#eab30820', color: '#eab308' }}>📧 Follow up</button>
                      )}
                      {app.job_url && <a href={app.job_url} target="_blank" rel="noopener" className="px-2 py-1 rounded text-xs" style={{ background: brand + '20', color: brand }}>🔗</a>}
                      <button onClick={() => deleteEntry(app.id)} className="px-2 py-1 rounded text-xs" style={{ background: '#ef444420', color: '#ef4444' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: card, border: `1px solid ${border}` }}>
              <h2 className="text-lg font-semibold mb-4">Track New Application</h2>
              <div className="space-y-3">
                <input value={newEntry.job_title} onChange={e => setNewEntry({ ...newEntry, job_title: e.target.value })} placeholder="Job title *" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}`, color: text }} />
                <input value={newEntry.company_name} onChange={e => setNewEntry({ ...newEntry, company_name: e.target.value })} placeholder="Company name *" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}`, color: text }} />
                <input value={newEntry.job_url} onChange={e => setNewEntry({ ...newEntry, job_url: e.target.value })} placeholder="Job URL" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}`, color: text }} />
                <select value={newEntry.status} onChange={e => setNewEntry({ ...newEntry, status: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}`, color: text }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <textarea value={newEntry.notes} onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })} placeholder="Notes..." rows={3} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}`, color: text, resize: 'vertical' }} />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={addEntry} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: brand, color: '#000' }}>Add</button>
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bg, border: `1px solid ${border}` }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
