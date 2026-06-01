'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface JobMatch {
  id: string
  title: string
  company: string
  location: string
  match_score: number
  match_reasons: string[]
  skills_match: string[]
  job_type: string
  remote_type: string
  posted_date: string
}

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
}

export default function MatchesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<'candidate' | 'recruiter' | null>(null)
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([])
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>([])
  const [view, setView] = useState<'jobs' | 'candidates'>('jobs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRoleAndMatches()
  }, [])

  const loadRoleAndMatches = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/login'); return }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
    const roleList = (roles || []).map((r: any) => r.role)

    if (roleList.includes('recruiter')) {
      setRole('recruiter')
      setView('candidates')
      loadCandidateMatches(session.user.id)
    } else {
      setRole('candidate')
      setView('jobs')
      loadJobMatches(session.user.id)
    }
  }

  const loadJobMatches = async (userId: string) => {
    const { data } = await supabase
      .from('ai_matches')
      .select('*, jobs(title, company, location, job_type, remote_type, posted_date)')
      .eq('candidate_id', userId)
      .order('match_score', { ascending: false })
      .limit(50)

    setJobMatches((data || []).map((m: any) => ({
      id: m.id,
      title: m.jobs?.title || 'Unknown',
      company: m.jobs?.company || 'Unknown',
      location: m.jobs?.location || '—',
      match_score: m.match_score,
      match_reasons: m.match_reasons || [],
      skills_match: m.skills_match || [],
      job_type: m.jobs?.job_type || '—',
      remote_type: m.jobs?.remote_type || '—',
      posted_date: m.jobs?.posted_date,
    })))
    setLoading(false)
  }

  const loadCandidateMatches = async (userId: string) => {
    const { data } = await supabase
      .from('ai_matches')
      .select('*, profiles:user_id(full_name, email, headline, seeking_status, last_active_at)')
      .eq('recruiter_id', userId)
      .order('match_score', { ascending: false })
      .limit(50)

    setCandidateMatches((data || []).map((m: any) => ({
      id: m.id,
      email: m.profiles?.email || '',
      full_name: m.profiles?.full_name || 'Unknown',
      headline: m.profiles?.headline || '',
      match_score: m.match_score,
      match_reasons: m.match_reasons || [],
      skills_match: m.skills_match || [],
      seeking_status: m.profiles?.seeking_status || '—',
      last_active_at: m.profiles?.last_active_at,
    })))
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center">Loading matches...</div>

  const bg = 'var(--bg-base)'
  const card = 'var(--bg-elevated)'
  const text = 'var(--text-primary)'
  const muted = 'var(--text-secondary)'
  const border = 'var(--border)'

  return (
    <div className="min-h-screen" style={{ background: bg, color: text }}>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">AI {role === 'recruiter' ? 'Candidate' : 'Job'} Matches</h1>
        <p className="text-sm mb-6" style={{ color: muted }}>Personalized matches powered by AI analysis of your profile and preferences</p>

        {role === 'recruiter' && view === 'candidates' && (
          <div className="space-y-3">
            {candidateMatches.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: card, border: `1px solid ${border}` }}>
                <p style={{ color: muted }}>No candidate matches yet. <Link href="/search">Search jobs to find candidates</Link></p>
              </div>
            ) : candidateMatches.map(c => (
              <div key={c.id} className="rounded-xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{c.full_name}</h3>
                    <p className="text-sm" style={{ color: muted }}>{c.headline || c.email}</p>
                    <div className="flex gap-3 mt-2 text-xs" style={{ color: muted }}>
                      <span>Status: {c.seeking_status.replace(/_/g, ' ')}</span>
                      {c.last_active_at && <span>Active: {new Date(c.last_active_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--brand)20', color: 'var(--brand)' }}>
                    {Math.round(c.match_score * 100)}%
                  </div>
                </div>
                {c.skills_match.length > 0 && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {c.skills_match.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs" style={{ background: '#44ff4420', color: '#44ff44' }}>{s}</span>
                    ))}
                  </div>
                )}
                {c.match_reasons.length > 0 && (
                  <ul className="mt-2 text-xs" style={{ color: muted }}>
                    {c.match_reasons.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {role !== 'recruiter' && view === 'jobs' && (
          <div className="space-y-3">
            {jobMatches.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: card, border: `1px solid ${border}` }}>
                <p style={{ color: muted }}>Complete your profile for personalized job matches</p>
                <Link href="/settings" className="text-sm mt-2 inline-block" style={{ color: 'var(--brand)' }}>Go to Settings →</Link>
              </div>
            ) : jobMatches.map(j => (
              <div key={j.id} className="rounded-xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{j.title}</h3>
                    <p className="text-sm" style={{ color: muted }}>{j.company} • {j.location}</p>
                    <div className="flex gap-3 mt-1 text-xs" style={{ color: muted }}>
                      <span>{j.job_type?.replace(/_/g, ' ')}</span>
                      <span>{j.remote_type}</span>
                      {j.posted_date && <span>Posted {new Date(j.posted_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--brand)20', color: 'var(--brand)' }}>
                    {Math.round(j.match_score * 100)}%
                  </div>
                </div>
                {j.skills_match.length > 0 && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {j.skills_match.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs" style={{ background: '#4444ff20', color: '#4444ff' }}>{s}</span>
                    ))}
                  </div>
                )}
                {j.match_reasons.length > 0 && (
                  <ul className="mt-2 text-xs" style={{ color: muted }}>
                    {j.match_reasons.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
