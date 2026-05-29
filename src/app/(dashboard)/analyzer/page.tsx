'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ATSScore {
  overallScore: number
  breakdown: {
    keywordMatch: number
    skillsAlignment: number
    experienceRelevance: number
    formatCompliance: number
    impactQuantification: number
  }
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
  summary: string
}

interface Resume {
  id: string
  name: string
  content: any
  is_default?: boolean
}

interface Job {
  id: string
  title: string
  company_name: string
  description: string | null
}

const SCORE_COLORS = [
  { min: 80, color: '#22c55e', label: 'Excellent', emoji: '🟢' },
  { min: 60, color: '#eab308', label: 'Good',      emoji: '🟡' },
  { min: 40, color: '#f97316', label: 'Fair',      emoji: '🟠' },
  { min: 0,  color: '#ef4444', label: 'Needs Work', emoji: '🔴' },
]

function getScoreInfo(score: number) {
  return SCORE_COLORS.find(s => score >= s.min) || SCORE_COLORS[SCORE_COLORS.length - 1]
}

export default function ResumeAnalyzerPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedResume, setSelectedResume] = useState('')
  const [selectedJob, setSelectedJob] = useState('')
  const [customJobTitle, setCustomJobTitle] = useState('')
  const [customJobDesc, setCustomJobDesc] = useState('')
  const [useCustomJob, setUseCustomJob] = useState(false)
  const [result, setResult] = useState<ATSScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [quickResult, setQuickResult] = useState<any>(null)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [rRes, jRes] = await Promise.all([
      supabase.from('resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, title, company_name, description').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])
    if (rRes.data) {
      setResumes(rRes.data)
      if (rRes.data.length > 0 && !selectedResume) setSelectedResume(rRes.data[0].id)
    }
    if (jRes.data) {
      setJobs(jRes.data)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getResumeText = (resume: Resume): string => {
    if (!resume.content) return ''
    if (typeof resume.content === 'string') return resume.content
    if (resume.content.text) return resume.content.text
    return JSON.stringify(resume.content)
  }

  const handleAnalyze = async () => {
    if (!selectedResume) { setError('Select a resume'); return }

    const resume = resumes.find(r => r.id === selectedResume)
    if (!resume) return

    const resumeText = getResumeText(resume)
    if (!resumeText.trim()) { setError('Resume has no content'); return }

    let jobTitle = ''
    let jobDesc = ''
    let company = ''

    if (useCustomJob) {
      if (!customJobTitle.trim()) { setError('Enter a job title'); return }
      jobTitle = customJobTitle
      jobDesc = customJobDesc
    } else {
      if (!selectedJob) { setError('Select a job or enter custom job details'); return }
      const job = jobs.find(j => j.id === selectedJob)
      if (!job) return
      jobTitle = job.title
      jobDesc = job.description || ''
      company = job.company_name
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobTitle, jobDescription: jobDesc, company }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Analysis failed')
      }
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const runQuickCheck = async () => {
    const resume = resumes.find(r => r.id === selectedResume)
    const resumeText = resume ? getResumeText(resume) : ''
    const jobText = useCustomJob ? `${customJobTitle} ${customJobDesc}` : ''
    if (!resumeText || !jobText) return

    const params = new URLSearchParams({ resume: resumeText, job: jobText })
    const res = await fetch(`/api/ai/resume?${params}`)
    if (res.ok) setQuickResult(await res.json())
  }

  const scoreInfo = result ? getScoreInfo(result.overallScore) : null

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Resume Analyzer</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Check your resume's ATS compatibility against any job description
          </p>
        </div>

        {/* Input Section */}
        <div className="rounded-xl border p-5 mb-6 space-y-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
          {/* Resume selector */}
          <div>
            <label className="text-[12px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-quaternary)' }}>Resume</label>
            <select
              value={selectedResume}
              onChange={e => setSelectedResume(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {resumes.length === 0 && <option value="">No resumes — add one first</option>}
              {resumes.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_default ? ' ★' : ''}</option>)}
            </select>
          </div>

          {/* Job source toggle */}
          <div>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={!useCustomJob} onChange={() => setUseCustomJob(false)} style={{ accentColor: 'var(--brand)' }} />
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>From My Jobs</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={useCustomJob} onChange={() => setUseCustomJob(true)} style={{ accentColor: 'var(--brand)' }} />
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Paste Job Description</span>
              </label>
            </div>

            {!useCustomJob ? (
              <select
                value={selectedJob}
                onChange={e => setSelectedJob(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="">Select a job...</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>)}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Job title *"
                  value={customJobTitle}
                  onChange={e => setCustomJobTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <textarea
                  placeholder="Paste job description..."
                  value={customJobDesc}
                  onChange={e => setCustomJobDesc(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedResume}
            className="text-[13px] font-medium px-6 py-2.5 rounded-lg text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'var(--brand)' }}
          >
            {loading ? 'Analyzing...' : '✦ Analyze ATS Score'}
          </button>
        </div>

        {/* Results */}
        {!result && !loading && (
          <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
              <span className="text-[24px]">📊</span>
            </div>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>Select a resume and job to analyze</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-quaternary)' }}>
              Get an ATS compatibility score, missing skills analysis, and improvement suggestions
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border p-5 animate-pulse" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="h-6 rounded w-1/3 mb-3" style={{ background: 'var(--bg-surface)' }} />
                <div className="h-4 rounded w-2/3" style={{ background: 'var(--bg-surface)' }} />
              </div>
            ))}
          </div>
        )}

        {result && scoreInfo && (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-panel)', borderColor: `${scoreInfo.color}30` }}>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-[32px]">{scoreInfo.emoji}</span>
                <span className="text-[48px] font-bold" style={{ color: scoreInfo.color }}>{result.overallScore}</span>
                <span className="text-[14px] font-medium mt-4" style={{ color: scoreInfo.color }}>{scoreInfo.label}</span>
              </div>
              <p className="text-[14px] max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>{result.summary}</p>
            </div>

            {/* Breakdown */}
            {result.breakdown && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Score Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(result.breakdown).map(([key, value]) => {
                    const score = value as number
                    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[12px] w-36 text-right" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
                        </div>
                        <span className="text-[12px] font-medium w-8 text-right" style={{ color: color }}>{score}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.matchedSkills?.length > 0 && (
                <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <h3 className="text-[14px] font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span>✓</span> Matched Skills ({result.matchedSkills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedSkills.map((skill: string, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.missingSkills?.length > 0 && (
                <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <h3 className="text-[14px] font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span>⚠</span> Missing Skills ({result.missingSkills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingSkills.map((skill: string, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions */}
            {result.suggestions?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>💡 Improvement Suggestions</h3>
                <div className="space-y-2">
                  {result.suggestions.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-1.5">
                      <span className="text-[12px] flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-bright)' }}>{i + 1}.</span>
                      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
