'use client'

import { useState, useCallback } from 'react'

interface SearchJob {
  external_id: string
  title: string
  company_name: string
  location: string
  salary_min: number | null
  salary_max: number | null
  description: string
  url: string | null
  source: string
  source_detail: string
  posted_at: string | null
  job_type: string | null
  is_remote: boolean
  match_score: number
  saved?: boolean
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  jsearch:  { label: 'JSearch',  color: '#5e6ad2' },
  indeed:   { label: 'Indeed',   color: '#2557a7' },
  google:   { label: 'Google',   color: '#4285f4' },
  linkedin: { label: 'LinkedIn', color: '#0a66c2' },
  manual:   { label: 'Manual',   color: '#6b7280' },
}

const MATCH_LABELS = [
  { min: 80, label: 'Great match', color: '#22c55e' },
  { min: 60, label: 'Good match',  color: '#eab308' },
  { min: 40, label: 'Fair match',  color: '#f97316' },
  { min: 0,  label: 'Low match',   color: '#6b7280' },
]

function getMatchInfo(score: number) {
  return MATCH_LABELS.find(m => score >= m.min) || MATCH_LABELS[MATCH_LABELS.length - 1]
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function JobSearchPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [jobs, setJobs] = useState<SearchJob[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [sources, setSources] = useState({ jsearch: true, indeed: true, google: true })
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const inputStyle = { background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  // Track saved state via savedIds set when user clicks Save
  const handleSearch = useCallback(async () => {
    if (!query.trim() && !location.trim()) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const activeSources = Object.entries(sources).filter(([, v]) => v).map(([k]) => k).join(',')
      const params = new URLSearchParams({
        q: query,
        location,
        sources: activeSources,
        page: '1',
      })
      const res = await fetch(`/api/jobs/search?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Search failed (${res.status})`)
      }
      const data = await res.json()
      setJobs(data.jobs || [])
      if (data.errors) {
        console.warn('Source errors:', data.errors)
      }
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [query, location, sources])

  const handleSave = async (job: SearchJob) => {
    setSaving(job.external_id)
    try {
      const res = await fetch('/api/jobs/search/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      })
      if (res.status === 409) {
        setSavedIds(prev => new Set(prev).add(job.external_id))
        return
      }
      if (!res.ok) throw new Error('Failed to save')
      setSavedIds(prev => new Set(prev).add(job.external_id))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(null)
    }
  }

  const activeCount = Object.values(sources).filter(Boolean).length

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Find Jobs</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Search across LinkedIn, Indeed, Glassdoor, and more — all in one place
          </p>
        </div>

        {/* Search Bar */}
        <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Job title, keywords, or company"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                placeholder="City, state, or 'Remote'"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] focus:outline-none"
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || (!query.trim() && !location.trim())}
              className="px-6 py-2.5 rounded-lg text-white text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              style={{ background: 'var(--brand)' }}
            >
              {loading ? 'Searching...' : 'Search Jobs'}
            </button>
          </div>

          {/* Source toggles */}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-quaternary)' }}>Sources:</span>
            {(['jsearch', 'indeed', 'google'] as const).map(src => (
              <label key={src} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources[src]}
                  onChange={e => setSources(s => ({ ...s, [src]: e.target.checked }))}
                  className="rounded"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span className="text-[12px]" style={{ color: sources[src] ? 'var(--text-secondary)' : 'var(--text-quaternary)' }}>
                  {SOURCE_LABELS[src]?.label || src}
                </span>
              </label>
            ))}
            {activeCount === 0 && (
              <span className="text-[12px]" style={{ color: 'var(--danger)' }}>Select at least one source</span>
            )}
          </div>

          {/* API key hints */}
          <div className="mt-3 text-[11px] px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(94,106,210,0.1)', color: 'var(--brand-bright)' }}>
            <span>💡</span>
            <span>Job search requires free API keys: <strong>RapidAPI</strong> (JSearch) and <strong>SerpApi</strong>. Add them in Vercel env vars to enable search.</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-[13px] px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {!searched ? (
          <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>Search for your next opportunity</p>
            <p className="text-[13px] mt-1 max-w-md mx-auto" style={{ color: 'var(--text-quaternary)' }}>
              Enter a job title, keyword, or company name above. We'll search across LinkedIn, Indeed, Glassdoor, and more.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-lg border p-4 animate-pulse" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--bg-surface)' }} />
                <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-surface)' }} />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>No jobs found</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Try broadening your search terms or changing the location</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                {jobs.length} jobs found · Sorted by match score
              </p>
            </div>
            {jobs.map(job => {
              const match = getMatchInfo(job.match_score)
              const srcInfo = SOURCE_LABELS[job.source] || { label: job.source, color: '#6b7280' }
              const isSaved = savedIds.has(job.external_id)
              const isExpanded = expanded === job.external_id

              return (
                <div
                  key={job.external_id}
                  className="rounded-lg border p-4 transition-colors"
                  style={{ background: 'var(--bg-panel)', borderColor: isExpanded ? 'var(--brand)' : 'var(--border-subtle)' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Match score */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center" style={{ background: `${match.color}15`, border: `1px solid ${match.color}30` }}>
                      <span className="text-[14px] font-bold" style={{ color: match.color }}>{job.match_score}</span>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</h3>
                        {job.is_remote && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Remote</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[13px] flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        <span>{job.company_name}</span>
                        {job.location && <span>· {job.location}</span>}
                        {(job.salary_min || job.salary_max) && (
                          <span>· ${(job.salary_min || 0).toLocaleString()} - ${(job.salary_max || 0).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${srcInfo.color}15`, color: srcInfo.color }}>
                          {srcInfo.label}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${match.color}15`, color: match.color }}>
                          {match.label}
                        </span>
                        {job.posted_at && (
                          <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(job.posted_at)}</span>
                        )}
                        {job.job_type && (
                          <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{job.job_type}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : job.external_id)}
                        className="text-[12px] font-medium px-2.5 py-1.5 rounded-md border transition-colors"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                      <button
                        onClick={() => handleSave(job)}
                        disabled={isSaved || saving === job.external_id}
                        className="text-[12px] font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50"
                        style={{ background: isSaved ? '#22c55e' : 'var(--brand)' }}
                      >
                        {isSaved ? '✓ Saved' : saving === job.external_id ? '...' : 'Save'}
                      </button>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--brand-bright)' }}
                        >
                          Apply ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Expanded description */}
                  {isExpanded && job.description && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[13px] whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {job.description}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
