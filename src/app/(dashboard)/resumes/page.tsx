'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [tailorJobId, setTailorJobId] = useState('')
  const [jobs, setJobs] = useState<{ id: string; title: string; description: string | null; company: string }[]>([])
  const [tailoringResumeId, setTailoringResumeId] = useState<string | null>(null)
  const [formTab, setFormTab] = useState<'upload' | 'text'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const fetchResumes = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [resumesRes, jobsRes] = await Promise.all([
      supabase.from('resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, title, description, company').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (resumesRes.data) setResumes(resumesRes.data)
    if (jobsRes.data) setJobs(jobsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchResumes() }, [fetchResumes])

  const resetForm = () => {
    setFormName('')
    setFormContent('')
    setEditResume(null)
    setShowForm(false)
    setError('')
    setUploadProgress('')
    setFormTab('upload')
  }

  const handleEdit = (resume: Resume) => {
    setFormName(resume.name)
    setFormContent(typeof resume.content === 'string' ? resume.content : JSON.stringify(resume.content, null, 2))
    setEditResume(resume)
    setFormTab('text')
    setShowForm(true)
  }

  // ── File upload with text extraction ──
  const processFile = async (file: File) => {
    setUploadLoading(true)
    setError('')
    setUploadProgress('Uploading...')

    try {
      // Validate
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10MB)')
      }
      const ext = file.name.toLowerCase().split('.').pop()
      const allowed = ['txt', 'pdf', 'docx', 'doc']
      if (!allowed.includes(ext || '')) {
        throw new Error('Unsupported type. Use PDF, DOCX, DOC, or TXT.')
      }

      const fd = new FormData()
      fd.append('file', file)

      setUploadProgress('Extracting text...')
      const res = await fetch('/api/resumes/upload', { method: 'POST', body: fd })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      setFormContent(data.text)
      setFormName(file.name.replace(/\.[^.]+$/, ''))
      setFormTab('text') // Switch to text view so user can review/edit
      setUploadProgress(`✓ Extracted ${data.wordCount} words from ${file.name}`)
    } catch (err: any) {
      setError(err.message)
      setUploadProgress('')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = '' // Reset
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

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
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{resumes.length} resumes · Upload or paste · AI-tailored for each application</p>
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
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
            </select>
            {tailorJobId && <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>Then click "Tailor" on a resume below</span>}
          </div>
        )}

        {/* ── Add/Edit Form ── */}
        {showForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(' }, borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{editResume ? 'Edit Resume' : 'Add New Resume'}</h3>
              <button onClick={resetForm} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕ Close</button>
            </div>

            {error && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}

            {/* Tab switcher */}
            {!editResume && (
              <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                <button
                  type="button"
                  onClick={() => setFormTab('upload')}
                  className="flex-1 text-[13px] font-medium py-2 rounded-md transition-colors"
                  style={{
                    background: formTab === 'upload' ? 'var(--bg-panel)' : 'transparent',
                    color: formTab === 'upload' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    boxShadow: formTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  📄 Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setFormTab('text')}
                  className="flex-1 text-[13px] font-medium py-2 rounded-md transition-colors"
                  style={{
                    background: formTab === 'text' ? 'var(--bg-panel)' : 'transparent',
                    color: formTab === 'text' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    boxShadow: formTab === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  ✏️ Paste Text
                </button>
              </div>
            )}

            {/* Upload tab */}
            {formTab === 'upload' && !editResume && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? 'var(--brand)' : 'var(--border-subtle)',
                  background: dragOver ? 'rgba(94,106,210,0.05)' : 'var(--bg-surface)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadLoading ? (
                  <div>
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>{uploadProgress || 'Processing...'}</p>
                  </div>
                ) : uploadProgress.startsWith('✓') ? (
                  <div>
                    <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--success, #22c55e)' }}>{uploadProgress}</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>Review and edit below, or click to upload a different file</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-quaternary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Drop your resume here or <span style={{ color: 'var(--brand-bright)' }}>browse files</span>
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>PDF, DOCX, DOC, or TXT · Max 10MB</p>
                  </div>
                )}
              </div>
            )}

            {/* Text editor (always visible after upload, or when in text/edit mode) */}
            {(formTab === 'text' || editResume) && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Resume name *"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <textarea
                  placeholder="Resume content (plain text or JSON)"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y font-mono"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--brand)' }}
                  >
                    {formLoading ? 'Saving...' : editResume ? 'Update Resume' : 'Save Resume'}
                  </button>
                  {!editResume && formContent && (
                    <button
                      type="button"
                      onClick={() => setFormTab('upload')}
                      className="text-[13px] font-medium px-4 py-2 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)', background: 'transparent' }}
                    >
                      ← Upload Different File
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Save button for upload tab (when content is extracted) */}
            {formTab === 'upload' && !editResume && formContent && (
              <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                <input
                  type="text"
                  placeholder="Resume name *"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <div className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  ✓ {formContent.split(/\s+/).length} words extracted. <button type="button" onClick={() => setFormTab('text')} className="underline" style={{ color: 'var(--brand-bright)' }}>Review & edit</button> before saving.
                </div>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--brand)' }}
                >
                  {formLoading ? 'Saving...' : 'Save Resume'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Resume list ── */}
        {resumes.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-quaternary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-[14px] mb-2" style={{ color: 'var(--text-tertiary)' }}>No resumes yet.</p>
            <p className="text-[13px] mb-4" style={{ color: 'var(--text-quaternary)' }}>Upload a PDF or DOCX resume to get started, or paste your content directly.</p>
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              className="text-[13px] font-medium px-4 py-2 rounded-lg text-white"
              style={{ background: 'var(--brand)' }}
            >
              Upload Resume
            </button>
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
                    Added {new Date(resume.created_at).toLocaleDateString()} · {
                      typeof resume.content === 'string' ? resume.content.split(/\s+/).length :
                      resume.content?.text ? resume.content.text.split(/\s+/).length : 0
                    } words
                  </p>
                  {resume.content && (
                    <p className="text-[12px] mt-2 line-clamp-3 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {typeof resume.content === 'string' ? resume.content.substring(0, 300) : (resume.content?.text ? resume.content.text.substring(0, 300) : JSON.stringify(resume.content).substring(0, 300))}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
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
