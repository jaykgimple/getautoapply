'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  company_name: string
  location: string | null
  status: string
  source: string
  is_remote: boolean
  created_at: string
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

interface ActivityItem {
  id: string
  type: 'job_saved' | 'job_applied' | 'application_update' | 'interview' | 'offer'
  title: string
  subtitle: string
  created_at: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  saved:     { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af' },
  applied:   { bg: 'rgba(94,106,210,0.15)',   text: '#5e6ad2' },
  interview: { bg: 'rgba(234,179,8,0.15)',    text: '#eab308' },
  offer:     { bg: 'rgba(34,197,94,0.15)',    text: '#22c55e' },
  rejected:  { bg: 'rgba(239,68,68,0.15)',    text: '#ef4444' },
  draft:     { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af' },
  submitted: { bg: 'rgba(94,106,210,0.15)',   text: '#5e6ad2' },
  viewed:    { bg: 'rgba(168,85,247,0.15)',   text: '#a855f7' },
  withdrawn: { bg: 'rgba(107,114,128,0.15)',  text: '#6b7280' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [jobsRes, appsRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('applications').select('*, jobs(title, company_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])

    if (jobsRes.data) setJobs(jobsRes.data)
    if (appsRes.data) setApplications(appsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Compute stats
  const totalJobs = jobs.length
  const totalApps = applications.length
  const savedJobs = jobs.filter(j => j.status === 'saved').length
  const appliedJobs = jobs.filter(j => j.status === 'applied').length
  const interviews = applications.filter(a => a.status === 'interview').length
  const offers = applications.filter(a => a.status === 'offer').length
  const rejected = applications.filter(a => a.status === 'rejected').length
  const responseRate = totalApps > 0 ? Math.round(((interviews + offers) / totalApps) * 100) : 0

  // Build activity feed (combined jobs + applications, sorted by date)
  const activities: ActivityItem[] = [
    ...jobs.slice(0, 10).map(j => ({
      id: `job-${j.id}`,
      type: j.status === 'applied' ? 'job_applied' as const : 'job_saved' as const,
      title: j.title,
      subtitle: `${j.company_name}${j.location ? ` · ${j.location}` : ''}`,
      created_at: j.created_at,
    })),
    ...applications.slice(0, 10).map(a => ({
      id: `app-${a.id}`,
      type: a.status === 'interview' ? 'interview' as const : a.status === 'offer' ? 'offer' as const : 'application_update' as const,
      title: a.jobs?.title || 'Untitled',
      subtitle: `${a.jobs?.company_name || 'Unknown'} · ${a.status}`,
      created_at: a.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)

  const activityIcons: Record<string, string> = {
    job_saved: '💾',
    job_applied: '📤',
    application_update: '📋',
    interview: '🎯',
    offer: '🎉',
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Your job search command center</p>
          </div>
          <Link
            href="/search"
            className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2"
            style={{ background: 'var(--brand)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Jobs
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Saved', value: savedJobs, color: 'var(--text-primary)' },
            { label: 'Applied', value: appliedJobs, color: 'var(--brand-bright)' },
            { label: 'Interviews', value: interviews, color: '#eab308' },
            { label: 'Offers', value: offers, color: '#22c55e' },
            { label: 'Rejected', value: rejected, color: '#ef4444' },
            { label: 'Response Rate', value: `${responseRate}%`, color: responseRate > 20 ? '#22c55e' : 'var(--text-primary)' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <p className="text-[24px] font-semibold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mt-1" style={{ color: 'var(--text-quaternary)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Search Jobs', href: '/search', icon: '🔍', desc: 'Find new opportunities' },
            { label: 'My Jobs', href: '/jobs', icon: '💼', desc: `${totalJobs} tracked` },
            { label: 'Applications', href: '/applications', icon: '📋', desc: `${totalApps} sent` },
            { label: 'Resumes', href: '/resumes', icon: '📄', desc: 'Manage resumes' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-lg border p-4 transition-colors hover:opacity-90 group"
              style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[16px]">{action.icon}</span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{action.desc}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Activity Feed */}
          <div className="lg:col-span-3 rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
            </div>
            <div className="p-4">
              {activities.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] mb-3" style={{ color: 'var(--text-tertiary)' }}>No activity yet. Start by searching for jobs!</p>
                  <Link href="/search" className="text-[13px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>
                    Search jobs →
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 rounded-md transition-colors" style={{ background: 'transparent' }}>
                      <span className="text-[14px] flex-shrink-0">{activityIcons[item.type] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{item.subtitle}</p>
                      </div>
                      <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(item.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Pipeline + Suggestions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pipeline Funnel */}
            <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Pipeline</h2>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Saved', count: savedJobs, color: '#6b7280' },
                  { label: 'Applied', count: appliedJobs, color: '#5e6ad2' },
                  { label: 'Interview', count: interviews, color: '#eab308' },
                  { label: 'Offer', count: offers, color: '#22c55e' },
                  { label: 'Rejected', count: rejected, color: '#ef4444' },
                ].map((stage, i) => {
                  const maxCount = Math.max(savedJobs, appliedJobs, interviews, offers, rejected, 1)
                  const width = Math.max(8, (stage.count / maxCount) * 100)
                  return (
                    <div key={stage.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium w-16 text-right" style={{ color: 'var(--text-tertiary)' }}>{stage.label}</span>
                      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="h-full rounded-full flex items-center justify-end pr-1.5 transition-all" style={{ width: `${width}%`, background: `${stage.color}30` }}>
                          {stage.count > 0 && <span className="text-[9px] font-bold" style={{ color: stage.color }}>{stage.count}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Suggested Actions */}
            <div className="rounded-lg border p-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Suggested Next Steps</h3>
              <div className="space-y-2">
                {savedJobs > 0 && (
                  <Link href="/jobs?filter=saved" className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded-md transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                    <span>📤</span>
                    <span>Apply to {savedJobs} saved {savedJobs === 1 ? 'job' : 'jobs'}</span>
                  </Link>
                )}
                {interviews > 0 && (
                  <Link href="/applications" className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded-md transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                    <span>🎯</span>
                    <span>Follow up on {interviews} {interviews === 1 ? 'interview' : 'interviews'}</span>
                  </Link>
                )}
                <Link href="/search" className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded-md transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                  <span>🔍</span>
                  <span>Search for new jobs</span>
                </Link>
                <Link href="/resumes" className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded-md transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>
                  <span>📄</span>
                  <span>Optimize your resume</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
