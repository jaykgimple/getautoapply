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

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [jobsRes, appsRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('applications').select('*, jobs(title, company_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])

    if (jobsRes.data) setJobs(jobsRes.data)
    if (appsRes.data) setApplications(appsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const totalJobs = jobs.length
  const totalApps = applications.length
  const interviews = applications.filter(a => a.status === 'interview' || a.status === 'offer').length
  const interviewRate = totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0

  const stats = [
    { label: 'Active Jobs', value: totalJobs, change: '' },
    { label: 'Applications', value: totalApps, change: '' },
    { label: 'Interview Rate', value: `${interviewRate}%`, change: '' },
    { label: 'Interviews + Offers', value: interviews, change: '' },
  ]

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
        <div className="mb-8">
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Dashboard
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Your job search at a glance
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <p className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-quaternary)' }}>{stat.label}</p>
              <p className="text-[28px] font-medium" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              {stat.change && <p className="text-[12px] mt-1" style={{ color: 'var(--success)' }}>{stat.change}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Applications */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Recent Applications</h2>
              <Link href="/applications" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>View all →</Link>
            </div>
            <div className="p-4">
              {applications.length === 0 ? (
                <p className="text-[13px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No applications yet. Track your first job to get started.</p>
              ) : (
                <div className="space-y-2">
                  {applications.slice(0, 5).map((app) => (
                    <div key={app.id} className="flex items-center justify-between py-2 px-2 rounded-md" style={{ background: 'var(--bg-surface)' }}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {app.jobs?.title || 'Untitled'}
                        </p>
                        <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>{app.jobs?.company_name || 'Unknown'}</p>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0" style={{
                        background: app.status === 'offer' ? 'rgba(34,197,94,0.15)' : app.status === 'interview' ? 'rgba(234,179,8,0.15)' : app.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                        color: app.status === 'offer' ? 'var(--success)' : app.status === 'interview' ? 'var(--warning)' : app.status === 'rejected' ? 'var(--danger)' : 'var(--text-tertiary)',
                      }}>{app.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Recent Jobs</h2>
              <Link href="/jobs" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>View all →</Link>
            </div>
            <div className="p-4">
              {jobs.length === 0 ? (
                <p className="text-[13px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No jobs yet. Add your first job to get started.</p>
              ) : (
                <div className="space-y-2">
                  {jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="flex items-center justify-between py-2 px-2 rounded-md" style={{ background: 'var(--bg-surface)' }}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</p>
                        <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0" style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-tertiary)',
                      }}>{job.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
