'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  title: string
  company_name: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  status: string
  source: string
  url: string | null
  description: string | null
  created_at: string
}

const STATUS_OPTIONS = ['saved', 'applied', 'interview', 'offer', 'rejected']

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [form, setForm] = useState({ title: '', company_name: '', location: '', url: '', description: '', source: 'manual', salary_min: '', salary_max: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setJobs(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const resetForm = () => {
    setForm({ title: '', company_name: '', location: '', url: '', description: '', source: 'manual', salary_min: '', salary_max: '' })
    setEditJob(null)
    setShowForm(false)
    setError('')
  }

  const handleEdit = (job: Job) => {
    setForm({
      title: job.title, company_name: job.company_name, location: job.location || '',
      url: job.url || '', description: job.description || '', source: job.source,
      salary_min: job.salary_min ? String(job.salary_min) : '',
      salary_max: job.salary_max ? String(job.salary_max) : '',
    })
    setEditJob(job)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const payload = {
        ...form,
        salary_min: form.salary_min ? parseInt(form.salary_min) : null,
        salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      }

      if (editJob) {
        const { error: err } = await supabase.from('jobs').update(payload).eq('id', editJob.id).eq('user_id', user.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('jobs').insert({ ...payload, user_id: user.id })
        if (err) throw err
      }
      resetForm()
      fetchJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to save job')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('jobs').delete().eq('id', id).eq('user_id', user.id)
    fetchJobs()
  }

  const handleStatusChange = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('jobs').update({ status }).eq('id', id).eq('user_id', user.id)
    fetchJobs()
  }

  const filteredJobs = jobs.filter(j => {
    if (filter !== 'all' && j.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return j.title.toLowerCase().includes(q) || j.company_name.toLowerCase().includes(q) || (j.location && j.location.toLowerCase().includes(q))
    }
    return true
  })

  const inputStyle = { background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Jobs</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{jobs.length} total · Search, save, and track job listings</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--brand)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Job
          </button>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{editJob ? 'Edit Job' : 'Add New Job'}</h3>
              <button onClick={resetForm} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕ Close</button>
            </div>
            {error && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Job title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <input type="text" placeholder="Company name *" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <input type="text" placeholder="Salary min" value={form.salary_min} onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <input type="text" placeholder="Salary max" value={form.salary_max} onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
              </div>
              <input type="url" placeholder="Job URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y" style={inputStyle} />
              <div className="flex items-center justify-between">
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="px-3 py-2 rounded-lg border text-[14px]" style={inputStyle}>
                  <option value="manual">Manual</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="indeed">Indeed</option>
                  <option value="referral">Referral</option>
                  <option value="other">Other</option>
                </select>
                <button type="submit" disabled={formLoading} className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                  {formLoading ? 'Saving...' : editJob ? 'Update Job' : 'Add Job'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 max-w-md relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search jobs, companies, keywords..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border text-[14px] focus:outline-none transition-colors" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-panel)' }}>
            {['all', ...STATUS_OPTIONS].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="text-[12px] font-medium px-3 py-1.5 rounded-md capitalize transition-colors" style={{ background: filter === f ? 'var(--bg-surface)' : 'transparent', color: filter === f ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Job List */}
        {loading ? (
          <div className="text-center py-12"><p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading jobs...</p></div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>{filter !== 'all' || search ? 'No jobs match your filters.' : 'No jobs yet. Add your first job listing to get started.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-4 flex items-center gap-4 group" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</h3>
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-quaternary)' }}>{job.source}</span>
                  </div>
                  <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                    {job.company_name}
                    {job.location ? ` · ${job.location}` : ''}
                    {(job.salary_min || job.salary_max) ? ` · $${job.salary_min || '?'} - $${job.salary_max || '?'}` : ''}
                  </p>
                  {job.description && <p className="text-[12px] mt-1 line-clamp-2" style={{ color: 'var(--text-quaternary)' }}>{job.description}</p>}
                </div>
                <select value={job.status} onChange={e => handleStatusChange(job.id, e.target.value)} className="text-[12px] font-medium px-2 py-1 rounded border focus:outline-none" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>Link ↗</a>}
                <button onClick={() => handleEdit(job)} className="opacity-0 group-hover:opacity-100 text-[12px] font-medium transition-opacity" style={{ color: 'var(--text-tertiary)' }}>Edit</button>
                <button onClick={() => handleDelete(job.id)} className="opacity-0 group-hover:opacity-100 text-[12px] font-medium transition-opacity" style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
