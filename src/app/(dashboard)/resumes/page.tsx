'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Resume {
  id: string
  name: string
  content: any
  is_default: boolean
  created_at: string
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editResume, setEditResume] = useState<Resume | null>(null)
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [tailorJobId, setTailorJobId] = useState('')
  const [jobs, setJobs] = useState<{ id: string; title: string; description: string | null }[]>([])
  const [tailoringResumeId, setTailoringResumeId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchResumes = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [resumesRes, jobsRes] = await Promise.all([
      supabase.from('resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, title, description').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (resumesRes.data) setResumes(resumesRes.data)
    if (jobsRes.data) setJobs(jobsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchResumes() }, [fetchResumes])

  const resetForm = () => { setFormName(''); setFormContent(''); setEditResume(null); setShowForm(false); setError('') }

  const handleEdit = (resume: Resume) => {
    setFormName(resume.name)
    setFormContent(typeof resume.content === 'string' ? resume.content : JSON.stringify(resume.content, null, 2))
    setEditResume(resume)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let parsedContent: any = {}
      try { parsedContent = JSON.parse(formContent) } catch { parsedContent = { text: formContent } }

      if (editResume) {
        const { error: err } = await supabase.from('resumes').update({ name: formName, content: parsedContent }).eq('id', editResume.id).eq('user_id', user.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('resumes').insert({ user_id: user.id, name: formName, content: parsedContent, is_default: resumes.length === 0 })
        if (err) throw err
      }
      resetForm()
      fetchResumes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resume?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('resumes').delete().eq('id', id).eq('user_id', user.id)
    fetchResumes()
  }

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('resumes').update({ is_default: false }).eq('user_id', user.id)
    await supabase.from('resumes').update({ is_default: true }).eq('id', id).eq('user_id', user.id)
    fetchResumes()
  }

  const handleAiTailor = async (resumeId: string) => {
    if (!tailorJobId) { setError('Select a job to tailor against'); return }
    const job = jobs.find(j => j.id === tailorJobId)
    if (!job) return
    setAiLoading(resumeId)
    setTailoringResumeId(resumeId)
    setError('')

    try {
      const resume = resumes.find(r => r.id === resumeId)
      const resumeText = typeof resume?.content === 'string' ? resume.content : (resume?.content?.text || JSON.stringify(resume?.content || ''))
      const jobDesc = job.description || job.title

      const response = await fetch('/api/ai/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          jobDescription: jobDesc,
          company: job.company,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'AI request failed')
      }
      const data = await response.json()
      const tailoredText = data.tailoredResume || ''

      if (!tailoredText) throw new Error('No output from AI')

      // Save as new version
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('resumes').insert({
          user_id: user.id,
          name: `${resume?.name || 'Resume'} — tailored for ${job.title}`,
          content: { text: tailoredText },
          is_default: false,
        })
        fetchResumes()
      }
      setTailoringResumeId(null)
      setTailorJobId('')
    } catch (err: any) {
      setError(err.message || 'AI tailoring failed')
    } finally {
      setAiLoading(null)
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}><p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading resumes...</p></div>
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Resumes</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{resumes.length} resumes · AI-tailored for each job application</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--brand)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Resume
          </button>
        </div>

        {/* Tailor selector */}
        {resumes.length > 0 && jobs.length > 0 && (
          <div className="mb-4 rounded-lg border p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>AI Tailor:</span>
            <select value={tailorJobId} onChange={e => setTailorJobId(e.target.value)} className="text-[12px] px-2 py-1 rounded border focus:outline-none flex-1 min-w-[200px]" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              <option value="">Select job to tailor for...</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {tailorJobId && <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>Then click "Tailor" on a resume below</span>}
          </div>
        )}

        {showForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{editResume ? 'Edit Resume' : 'Add New Resume'}</h3>
              <button onClick={resetForm} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕ Close</button>
            </div>
            {error && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Resume name *" value={formName} onChange={e => setFormName(e.target.value)} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <textarea placeholder="Resume content (plain text or JSON)" value={formContent} onChange={e => setFormContent(e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y font-mono" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={formLoading} className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                {formLoading ? 'Saving...' : editResume ? 'Update Resume' : 'Add Resume'}
              </button>
            </form>
          </div>
        )}

        {resumes.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[14px] mb-2" style={{ color: 'var(--text-tertiary)' }}>No resumes yet.</p>
            <p className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>Upload your base resume to get started with AI tailoring.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((resume) => (
              <div key={resume.id} className="rounded-lg border p-4 flex items-start gap-4 group" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{resume.name}</h3>
                    {resume.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(94,106,210,0.15)', color: 'var(--brand-bright)' }}>DEFAULT</span>}
                  </div>
                  <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>
                    Added {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                  {resume.content && (
                    <p className="text-[12px] mt-2 line-clamp-3 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {typeof resume.content === 'string' ? resume.content : (resume.content?.text ? resume.content.text.substring(0, 300) : JSON.stringify(resume.content).substring(0, 300))}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {tailorJobId && (
                    <button
                      onClick={() => handleAiTailor(resume.id)}
                      disabled={aiLoading === resume.id}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--brand)', color: 'var(--brand-bright)', background: 'transparent' }}
                    >
                      {aiLoading === resume.id ? 'Tailoring...' : '✦ Tailor'}
                    </button>
                  )}
                  <button onClick={() => handleSetDefault(resume.id)} disabled={resume.is_default} className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)', background: 'transparent' }}>
                    {resume.is_default ? '★ Default' : 'Set Default'}
                  </button>
                  <button onClick={() => handleEdit(resume)} className="opacity-0 group-hover:opacity-100 text-[12px] font-medium transition-opacity" style={{ color: 'var(--text-tertiary)' }}>Edit</button>
                  <button onClick={() => handleDelete(resume.id)} className="opacity-0 group-hover:opacity-100 text-[12px] font-medium transition-opacity" style={{ color: 'var(--danger)' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
