'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  title: string
  company_name: string
  status: string
}

interface Application {
  id: string
  job_id: string
  status: string
  applied_date: string | null
  notes: string | null
  created_at: string
  jobs?: { title: string; company_name: string }
}

const COLUMNS = [
  { id: 'saved', label: 'Saved', color: 'var(--text-secondary)' },
  { id: 'applied', label: 'Applied', color: '#5e6ad2' },
  { id: 'interview', label: 'Interview', color: 'var(--warning)' },
  { id: 'offer', label: 'Offer', color: 'var(--success)' },
  { id: 'rejected', label: 'Rejected', color: 'var(--danger)' },
]

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formJobId, setFormJobId] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [appsRes, jobsRes] = await Promise.all([
      supabase.from('applications').select('*, jobs(title, company_name)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, title, company_name, status').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (appsRes.data) setApplications(appsRes.data)
    if (jobsRes.data) setJobs(jobsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: err } = await supabase.from('applications').insert({
        user_id: user.id, job_id: formJobId, status: 'saved', notes: formNotes || null,
      })
      if (err) throw err
      setShowForm(false)
      setFormJobId('')
      setFormNotes('')
      fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleStatusChange = async (appId: string, newStatus: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const updates: any = { status: newStatus }
    if (newStatus === 'applied') updates.applied_date = new Date().toISOString()
    await supabase.from('applications').update(updates).eq('id', appId).eq('user_id', user.id)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('applications').delete().eq('id', id).eq('user_id', user.id)
    fetchData()
  }

  const getAppsByStatus = (status: string) => applications.filter(a => a.status === status)

  if (loading) {
    return <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}><p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading applications...</p></div>
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Applications</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{applications.length} tracked · Pipeline across all stages</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--brand)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Application
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Link to Job</h3>
              <button onClick={() => setShowForm(false)} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕ Close</button>
            </div>
            {error && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <select value={formJobId} onChange={e => setFormJobId(e.target.value)} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Select a job...</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>)}
              </select>
              <textarea placeholder="Notes (optional)" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={formLoading || !formJobId} className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                {formLoading ? 'Adding...' : 'Add Application'}
              </button>
            </form>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const apps = getAppsByStatus(col.id)
            return (
              <div key={col.id} className="flex-shrink-0 w-64 rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[13px] font-medium" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-quaternary)' }}>{apps.length}</span>
                </div>
                <div className="p-2 min-h-[200px] space-y-2">
                  {apps.map((app) => (
                    <div key={app.id} className="rounded-lg border p-3 group" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[13px] font-medium mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>{app.jobs?.title || 'Unknown job'}</p>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--text-quaternary)' }}>{app.jobs?.company_name || ''}</p>
                      {app.notes && <p className="text-[11px] mb-2 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{app.notes}</p>}
                      <div className="flex items-center justify-between">
                        <select value={app.status} onChange={e => handleStatusChange(app.id, e.target.value)} className="text-[11px] px-1.5 py-0.5 rounded border focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <button onClick={() => handleDelete(app.id)} className="opacity-0 group-hover:opacity-100 text-[11px] transition-opacity" style={{ color: 'var(--danger)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {apps.length === 0 && (
                    <p className="text-[12px] text-center py-6" style={{ color: 'var(--text-quaternary)' }}>No applications</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
