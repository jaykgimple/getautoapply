'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SearchJob {
  id: string
  title: string
  company_name: string
  location: string
  salary_min: number | null
  salary_max: number | null
  description: string
  url: string | null
  source: string
  posted_at: string | null
  job_type: string | null
  is_remote: boolean
  match_score: number
}

interface SavedSearch {
  id: number
  search_term: string
  location: string
  remote_only: boolean
  job_type: string
}

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

const SOURCES = [
  { value: '', label: 'All Sources' },
  { value: 'jobspy_linkedin', label: 'LinkedIn' },
  { value: 'jobspy_indeed', label: 'Indeed' },
  { value: 'remoteok', label: 'RemoteOK' },
  { value: 'jobicy', label: 'Jobicy' },
  { value: 'weworkremotely', label: 'WeWorkRemotely' },
  { value: 'remotive', label: 'Remotive' },
]

const MATCH_LABELS = [
  { min: 80, label: 'Great match', color: '#22c55e' },
  { min: 60, label: 'Good match', color: '#eab308' },
  { min: 40, label: 'Fair match', color: '#f97316' },
  { min: 0, label: 'Low match', color: '#6b7280' },
]

function getMatchInfo(score: number) {
  return MATCH_LABELS.find(m => score >= m.min) || MATCH_LABELS[MATCH_LABELS.length - 1]
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'Just now'
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
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [jobType, setJobType] = useState('')
  const [source, setSource] = useState('')
  const [jobs, setJobs] = useState<SearchJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [totalJobs, setTotalJobs] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Saved search state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isCurrentSearchSaved, setIsCurrentSearchSaved] = useState(false)
  const [saveSearchLoading, setSaveSearchLoading] = useState(false)

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  }

  // Check if current search matches a saved search
  useEffect(() => {
    if (!query.trim() && !location.trim() && !remoteOnly && !jobType) {
      setIsCurrentSearchSaved(false)
      return
    }
    const match = savedSearches.find(s =>
      s.search_term === query.trim() &&
      s.location === location.trim() &&
      s.remote_only === remoteOnly &&
      s.job_type === jobType
    )
    setIsCurrentSearchSaved(!!match)
  }, [query, location, remoteOnly, jobType, savedSearches])

  const doSearch = useCallback(async (p = 1) => {
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (location.trim()) params.set('location', location.trim())
      if (remoteOnly) params.set('remote', 'true')
      if (jobType) params.set('job_type', jobType)
      if (source) params.set('source', source)
      params.set('page', String(p))
      params.set('limit', '25')

      const res = await fetch(`/api/jobs/search?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Search failed (${res.status})`)
      }
      const data = await res.json()
      setJobs(data.jobs || [])
      setTotalJobs(data.total || 0)
      setPage(p)
      setTotalPages(data.totalPages || 1)
    } catch (err: any) {
      setError(err.message || 'Search failed')
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [query, location, remoteOnly, jobType, source])

  // Load saved searches on mount
  useEffect(() => {
    doSearch(1)
    loadSavedSearches()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const loadSavedSearches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_search_terms')
        .select('id, search_term, location, remote_only, job_type')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (data) setSavedSearches(data)
    } catch (err) {
      console.error('Failed to load saved searches:', err)
    }
  }

  const handleSaveSearch = async () => {
    try {
      setSaveSearchLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('Please log in to save searches'); return }

      if (isCurrentSearchSaved) {
        const match = savedSearches.find(s =>
          s.search_term === query.trim() &&
          s.location === location.trim() &&
          s.remote_only === remoteOnly &&
          s.job_type === jobType
        )
        if (match) {
          await supabase.from('user_search_terms').update({ is_active: false }).eq('id', match.id)
          setSavedSearches(prev => prev.filter(s => s.id !== match.id))
          setIsCurrentSearchSaved(false)
        }
      } else {
        const searchTerm = query.trim() || location.trim()
        if (!searchTerm) { alert('Enter a search term or location first'); return }

        const { data, error } = await supabase.from('user_search_terms').insert({
          user_id: user.id,
          search_term: query.trim() || location.trim(),
          location: location.trim(),
          remote_only: remoteOnly,
          job_type: jobType,
          is_active: true,
        }).select('id, search_term, location, remote_only, job_type').single()

        if (error) {
          if (error.code !== '23505') {
            console.error('Save search error:', error)
            alert('Failed to save search')
            return
          }
        } else if (data) {
          setSavedSearches(prev => [data, ...prev])
          setIsCurrentSearchSaved(true)
        }
      }
    } catch (err: any) {
      alert('Failed to save search')
    } finally {
      setSaveSearchLoading(false)
    }
  }

  const handleSave = async (e: React.MouseEvent, job: SearchJob) => {
    e.stopPropagation()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('Please log in to save jobs'); return }

      const { error } = await supabase.from('jobs').insert({
        user_id: user.id,
        title: job.title,
        company: job.company_name,
        location: job.location,
        job_url: job.url,
        description: job.description,
        source: `saved_from_${job.source}`,
        job_type: job.job_type,
        remote_type: job.is_remote ? 'remote' : 'onsite',
        status: 'saved',
        salary_min: job.salary_min,
        salary_max: job.salary_max,
      })

      if (!error) {
        setSavedIds(prev => new Set(prev).add(job.id))
      } else if (error.code === '23505') {
        setSavedIds(prev => new Set(prev).add(job.id))
      } else {
        console.error('Save error:', error)
      }
    } catch (err: any) {
      alert('Failed to save job')
    }
  }

  const handleCardClick = (e: React.MouseEvent, jobId: string) => {
    // Don't toggle if clicking buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return
    setExpanded(expanded === jobId ? null : jobId)
  }

  const clearFilters = () => {
    setQuery('')
    setLocation('')
    setRemoteOnly(false)
    setJobType('')
    setSource('')
  }

  const canSaveSearch = query.trim() || location.trim()

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Find Jobs</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {totalJobs > 0 ? `${totalJobs.toLocaleString()} jobs in our database · New jobs added hourly from 7 sources` : 'Thousands of jobs updated hourly from LinkedIn, Indeed, RemoteOK, and more'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 2l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Job title, keywords, or company" value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(1)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="text" placeholder="City, state, or 'Remote'" value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(1)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
            </div>
            <button onClick={() => doSearch(1)} disabled={loading}
              className="px-6 py-2.5 rounded-lg text-white text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              style={{ background: 'var(--brand)' }}>
              {loading ? 'Searching...' : 'Search Jobs'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)}
                className="rounded" style={{ accentColor: 'var(--brand)' }} />
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Remote only</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>Type:</span>
              <select value={jobType} onChange={e => setJobType(e.target.value)}
                className="text-[12px] rounded border px-2 py-1" style={{ ...inputStyle, padding: '2px 8px' }}>
                {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>Source:</span>
              <select value={source} onChange={e => setSource(e.target.value)}
                className="text-[12px] rounded border px-2 py-1" style={{ ...inputStyle, padding: '2px 8px' }}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <button onClick={clearFilters}
              className="text-[12px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>Clear filters</button>

            {/* Save Search button */}
            {searched && canSaveSearch && (
              <button
                onClick={handleSaveSearch}
                disabled={saveSearchLoading}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-md border transition-colors disabled:opacity-50"
                style={{
                  borderColor: isCurrentSearchSaved ? 'var(--brand)' : 'var(--border-subtle)',
                  color: isCurrentSearchSaved ? 'var(--brand)' : 'var(--text-secondary)',
                  background: isCurrentSearchSaved ? 'rgba(94,106,210,0.1)' : 'transparent',
                }}
              >
                {saveSearchLoading ? '...' : isCurrentSearchSaved ? '✓ Search saved' : '🔔 Save this search'}
              </button>
            )}
          </div>

          {/* Saved searches chips */}
          {savedSearches.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-quaternary)' }}>Saved searches:</span>
                {savedSearches.slice(0, 5).map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setQuery(s.search_term); setLocation(s.location); setRemoteOnly(s.remote_only); setJobType(s.job_type); doSearch(1); }}
                    className="text-[11px] px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    {s.search_term || s.location}
                    {s.remote_only ? ' (remote)' : ''}
                  </button>
                ))}
                {savedSearches.length > 5 && (
                  <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>+{savedSearches.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-[13px] px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-lg border p-4 animate-pulse" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--bg-surface)' }} />
                <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-surface)' }} />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 && searched ? (
          <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>No jobs found</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Try broadening your search terms or changing filters</p>
            {savedSearches.length === 0 && (
              <p className="text-[13px] mt-3" style={{ color: 'var(--text-quaternary)' }}>
                💡 Save this search and we'll automatically find new matching jobs every hour
              </p>
            )}
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                {totalJobs.toLocaleString()} jobs found · Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <button onClick={() => doSearch(page - 1)} className="text-[12px] px-2 py-1 rounded border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    ← Prev
                  </button>
                )}
                {page < totalPages && (
                  <button onClick={() => doSearch(page + 1)} className="text-[12px] px-2 py-1 rounded border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    Next →
                  </button>
                )}
              </div>
            </div>

            {jobs.map(job => {
              const match = getMatchInfo(job.match_score)
              const isSaved = savedIds.has(job.id)
              const isExpanded = expanded === job.id

              return (
                <div key={job.id}
                  className="rounded-lg border p-4 transition-all cursor-pointer select-none"
                  style={{ background: 'var(--bg-panel)', borderColor: isExpanded ? 'var(--brand)' : 'var(--border-subtle)' }}
                  onClick={(e) => handleCardClick(e, job.id)}>
                  <div className="flex items-start gap-4">
                    {/* Source badge */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold uppercase"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                      {job.source.replace('jobspy_', '').substring(0, 4)}
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
                        {job.location && job.location !== 'Remote' && <span>· {job.location}</span>}
                        {(job.salary_min || job.salary_max) && (
                          <span>· ${(job.salary_min || 0).toLocaleString()}{job.salary_max ? ` - $${job.salary_max.toLocaleString()}` : '+'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize"
                          style={{ background: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                          {job.source.replace('jobspy_', '').replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${match.color}15`, color: match.color }}>
                          {match.label}
                        </span>
                        {job.posted_at && (
                          <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(job.posted_at)}</span>
                        )}
                        {job.job_type && (
                          <span className="text-[11px] capitalize" style={{ color: 'var(--text-quaternary)' }}>{job.job_type.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={(e) => handleSave(e, job)} disabled={isSaved}
                        className="text-[12px] font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50"
                        style={{ background: isSaved ? '#22c55e' : 'var(--brand)' }}>
                        {isSaved ? '✓ Saved' : 'Save'}
                      </button>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer"
                          className="text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--brand-bright)' }}>
                          Apply ↗
                        </a>
                      )}
                      <div className="w-6 h-6 flex items-center justify-center rounded-md transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--text-quaternary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded description — only show if has content */}
                  {isExpanded && job.description && job.description.trim().length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[13px] whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {job.description}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {page > 1 && (
                  <button onClick={() => doSearch(page - 1)} className="text-[13px] px-3 py-1.5 rounded-md border"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    ← Previous
                  </button>
                )}
                <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <button onClick={() => doSearch(page + 1)} className="text-[13px] px-3 py-1.5 rounded-md border"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    Next →
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-quaternary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>Search for your next opportunity</p>
            <p className="text-[13px] mt-1 max-w-md mx-auto" style={{ color: 'var(--text-quaternary)' }}>
              Enter a job title, keyword, or company name above. Filter by location, type, or source.
            </p>
            <p className="text-[13px] mt-2 max-w-md mx-auto" style={{ color: 'var(--text-quaternary)' }}>
              💡 Save a search and we'll find new matching jobs for you every hour
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
