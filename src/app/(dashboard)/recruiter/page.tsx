'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CandidateMatch {
  id: string
  email: string
  full_name: string
  headline: string
  match_score: number
  match_reasons: string[]
  skills_match: string[]
  seeking_status: string
  last_active_at: string
  profile: any
}

export default function RecruiterDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [jobDescription, setJobDescription] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [matches, setMatches] = useState<CandidateMatch[]>([])
  const [activeTab, setActiveTab] = useState<'match' | 'jobs' | 'analytics'>('match')
  const [stats, setStats] = useState({ totalJobs: 0, totalCandidates: 0, activeMatches: 0 })

  const verifyRecruiter = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/login'); return false }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
    const roleList = (roles || []).map((r: any) => r.role)

    if (!roleList.includes('recruiter')) {
      router.push('/dashboard')
      return false
    }

    // Load stats
    const [{ count: jobsCount }, { count: candidatesCount }, { count: matchesCount }] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('candidate_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('ai_matches').select('id', { count: 'exact', head: true }).eq('recruiter_id', session.user.id),
    ])

    setStats({ totalJobs: jobsCount || 0, totalCandidates: candidatesCount || 0, activeMatches: matchesCount || 0 })
    setLoading(false)
    return true
  }, [])

  useEffect(() => { verifyRecruiter() }, [verifyRecruiter])

  const findMatches = async () => {
    if (!jobDescription.trim()) return
    setIsSearching(true)

    try {
      // Call the AI matching API
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      })

      if (res.ok) {
        const data = await res.json()
        setMatches(data.matches || [])
      } else {
        // Fallback: query candidates directly and score locally
        const { data: candidates } = await supabase
          .from('candidate_profiles')
          .select('*, profiles(full_name, email, headline, seeking_status, last_active_at)')
          .eq('seeking_status', 'actively_looking')
          .order('updated_at', { ascending: false })
          .limit(20)

        if (candidates) {
          // Simple keyword matching fallback
          const keywords = jobDescription.toLowerCase().split(/\s+/)
          const scored = candidates.map((c: any) => {
            const skills = (c.skills || []).map((s: any) => (typeof s === 'string' ? s : s.name || '').toLowerCase())
            const exp = JSON.stringify(c.experience || []).toLowerCase()
            const resumeText = (c.resume_text || '').toLowerCase()

            let score = 0
            const matchReasons: string[] = []
            const skillsMatch: string[] = []

            keywords.forEach(kw => {
              if (skills.some((s: string) => s.includes(kw) || kw.includes(s))) {
                score += 0.15
                if (skillsMatch.length < 5) skillsMatch.push(kw)
              }
              if (exp.includes(kw)) {
                score += 0.05
              }
              if (resumeText.includes(kw)) {
                score += 0.03
              }
            })

            if (c.remote_preference === 'remote') {
              score += 0.1
              matchReasons.push('Open to remote work')
            }

            return {
              id: c.id,
              email: c.profiles?.email || '',
              full_name: c.profiles?.full_name || 'Unknown',
              headline: c.profiles?.headline || '',
              match_score: Math.min(score, 0.95),
              match_reasons: matchReasons.length > 0 ? matchReasons : ['Skills align with job requirements'],
              skills_match: skillsMatch,
              seeking_status: c.profiles?.seeking_status || 'actively_looking',
              last_active_at: c.profiles?.last_active_at,
              profile: c,
            }
          }).sort((a: any, b: any) => b.match_score - a.match_score)

          setMatches(scored.slice(0, 10))
        }
      }
    } catch (e) {
      console.error('Match error:', e)
    } finally {
      setIsSearching(false)
    }
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>

  const bg = 'var(--bg-base)'
  const card = 'var(--bg-elevated)'
  const text = 'var(--text-primary)'
  const muted = 'var(--text-secondary)'
  const border = 'var(--border)'
  const brand = 'var(--brand)'

  return (
    <div className="min-h-screen" style={{ background: bg, color: text }}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Recruiter Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: muted }}>AI-powered candidate matching and pipeline management</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl p-4" style={{ background: card, border: `1px solid ${border}` }}>
            <p className="text-sm" style={{ color: muted }}>Open Jobs</p>
            <p className="text-2xl font-bold mt-1">{stats.totalJobs}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: card, border: `1px solid ${border}` }}>
            <p className="text-sm" style={{ color: muted }}>Active Candidates</p>
            <p className="text-2xl font-bold mt-1">{stats.totalCandidates}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: card, border: `1px solid ${border}` }}>
            <p className="text-sm" style={{ color: muted }}>Your Matches</p>
            <p className="text-2xl font-bold mt-1">{stats.activeMatches}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['match', 'jobs', 'analytics'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
              style={{ background: activeTab === tab ? brand : card, color: activeTab === tab ? '#000' : text, border: `1px solid ${activeTab === tab ? brand : border}` }}>
              {tab === 'match' ? '🎯 AI Candidate Match' : tab === 'jobs' ? '📋 Job Postings' : '📊 Analytics'}
            </button>
          ))}
        </div>

        {/* AI Match Tab */}
        {activeTab === 'match' && (
          <div>
            <div className="rounded-xl p-5 mb-6" style={{ background: card, border: `1px solid ${border}` }}>
              <h2 className="font-semibold text-lg mb-2">Find Your Perfect Candidate</h2>
              <p className="text-sm mb-4" style={{ color: muted }}>Paste a job description and our AI will match you with the best active candidates in the system</p>
              <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste your job description here... Include required skills, experience level, location preferences, etc."
                className="w-full p-4 rounded-lg text-sm" rows={6} style={{ background: bg, border: `1px solid ${border}`, color: text, resize: 'vertical' }} />
              <button onClick={findMatches} disabled={isSearching || !jobDescription.trim()}
                className="mt-3 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: brand, color: '#000' }}>
                {isSearching ? '🔍 Analyzing...' : '🎯 Find Matching Candidates'}
              </button>
            </div>

            {/* Results */}
            {matches.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Top {matches.length} Matches</h3>
                <div className="space-y-3">
                  {matches.map((m, i) => (
                    <div key={m.id} className="rounded-xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: brand + '20', color: brand }}>
                            {m.full_name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold">{m.full_name}</h4>
                            <p className="text-xs" style={{ color: muted }}>{m.headline || m.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold" style={{ color: brand }}>{Math.round(m.match_score * 100)}%</div>
                          <div className="text-xs" style={{ color: muted }}>match</div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-1 flex-wrap">
                        {m.skills_match.map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-xs" style={{ background: '#44ff4420', color: '#44ff44' }}>{s}</span>
                        ))}
                      </div>
                      {m.match_reasons.length > 0 && (
                        <ul className="mt-2 text-xs" style={{ color: muted }}>
                          {m.match_reasons.map((r, idx) => <li key={idx}>• {r}</li>)}
                        </ul>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: brand + '20', color: brand }}>
                          💬 Reach Out
                        </button>
                        {m.last_active_at && (
                          <span className="px-3 py-1.5 rounded text-xs" style={{ background: bg, color: muted }}>
                            Active {Math.floor((Date.now() - new Date(m.last_active_at).getTime()) / 86400000)}d ago
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matches.length === 0 && !isSearching && jobDescription.trim() === '' && (
              <div className="rounded-xl p-12 text-center" style={{ background: card, border: `1px solid ${border}` }}>
                <p className="text-lg mb-2">🎯 AI-Powered Matching</p>
                <p className="text-sm" style={{ color: muted }}>
                  Enter a job description above to find candidates who match your requirements.<br />
                  Our AI analyzes skills, experience, and preferences to find the best fits.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && <RecruiterJobs />}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="rounded-xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
            <p style={{ color: muted }}>Analytics coming soon. Track your hiring pipeline, response rates, and time-to-fill metrics.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RecruiterJobs() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('jobs').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setJobs(data || []))
  }, [])

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-semibold">Available Jobs ({jobs.length})</h3>
      </div>
      {jobs.length === 0 ? (
        <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
          <p>No jobs in the system yet.</p>
          <p className="text-sm mt-1">Job scraper will populate listings automatically.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {jobs.map(j => (
            <div key={j.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium">{j.title}</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{j.company} • {j.location || '—'} • {j.source}</p>
              </div>
              <a href={j.job_url} target="_blank" rel="noopener" className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--brand)20', color: 'var(--brand)' }}>
                View →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
