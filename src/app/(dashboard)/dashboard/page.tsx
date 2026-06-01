'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface OverviewData {
  totalSaved: number;
  totalActive: number;
  totalOffers: number;
  totalAccepted: number;
  upcomingInterviews: Array<{ id: string; round_type: string; scheduled_at: string; job_id: string }>;
  overdueFollowups: Array<{ id: string; job_id: string; applied_at: string; last_activity_at: string; pipeline_stage: string; jobs: { title: string; company: string } }>;
}

interface FunnelData {
  funnel: Array<{ stage: string; count: number }>;
  conversionRates: {
    savedToApplied: number;
    appliedToInterview: number;
    interviewToOffer: number;
    offerToAccept: number;
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return Math.floor(days / 7) + 'w ago';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, funnelRes] = await Promise.all([
        fetch('/api/analytics?type=overview').then(r => r.json()),
        fetch('/api/analytics?type=funnel').then(r => r.json()),
      ]);
      if (overviewRes.error) throw new Error(overviewRes.error);
      if (funnelRes.error) throw new Error(funnelRes.error);
      setOverview(overviewRes);
      setFunnel(funnelRes);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-[14px]" style={{ color: '#ef4444' }}>Error: {error}</div>
      </div>
    );
  }

  const o = overview || { totalSaved: 0, totalActive: 0, totalOffers: 0, totalAccepted: 0, upcomingInterviews: [], overdueFollowups: [] };
  const f = funnel || { funnel: [], conversionRates: { savedToApplied: 0, appliedToInterview: 0, interviewToOffer: 0, offerToAccept: 0 } };

  const stats = [
    { label: 'Saved', value: o.totalSaved, color: '#9ca3af' },
    { label: 'Active', value: o.totalActive, color: '#5e6ad2' },
    { label: 'Offers', value: o.totalOffers, color: '#22c55e' },
    { label: 'Accepted', value: o.totalAccepted, color: '#22c55e' },
    { label: 'Apply Rate', value: f.conversionRates.savedToApplied + '%', color: f.conversionRates.savedToApplied > 30 ? '#22c55e' : 'var(--text-primary)' },
    { label: 'Interview Rate', value: f.conversionRates.appliedToInterview + '%', color: f.conversionRates.appliedToInterview > 20 ? '#22c55e' : 'var(--text-primary)' },
  ];

  const maxFunnel = Math.max(...f.funnel.map(s => s.count), 1);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Your job search command center</p>
          </div>
          <div className="flex gap-2">
            <Link href="/search" className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--brand)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Jobs
            </Link>
            <Link href="/applications" className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              Pipeline
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <p className="text-[24px] font-semibold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mt-1" style={{ color: 'var(--text-quaternary)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Pipeline Funnel */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Pipeline Funnel</h2>
              <Link href="/applications" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>View all</Link>
            </div>
            <div className="p-4 space-y-2.5">
              {f.funnel.map((stage) => {
                const width = Math.max(4, (stage.count / maxFunnel) * 100);
                const colors: Record<string, string> = { saved: '#6b7280', applied: '#5e6ad2', screening: '#a855f7', interviewing: '#eab308', offer: '#22c55e', accepted: '#16a34a', rejected: '#ef4444', ghosted: '#9ca3af', withdrawn: '#6b7280' };
                const color = colors[stage.stage] || '#6b7280';
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium w-20 text-right capitalize" style={{ color: 'var(--text-tertiary)' }}>{stage.stage}</span>
                    <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                      <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: width + '%', background: color + '30' }}>
                        {stage.count > 0 && <span className="text-[10px] font-bold" style={{ color }}>{stage.count}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: 'var(--text-quaternary)' }}>
                  <div>Saved → Applied: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{f.conversionRates.savedToApplied}%</span></div>
                  <div>Applied → Interview: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{f.conversionRates.appliedToInterview}%</span></div>
                  <div>Interview → Offer: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{f.conversionRates.interviewToOffer}%</span></div>
                  <div>Offer → Accept: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{f.conversionRates.offerToAccept}%</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Interviews */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming Interviews</h2>
              <Link href="/applications" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>Schedule</Link>
            </div>
            <div className="p-4">
              {o.upcomingInterviews.length === 0 ? (
                <p className="text-[13px] text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No upcoming interviews</p>
              ) : (
                <div className="space-y-2">
                  {o.upcomingInterviews.map((iv) => (
                    <div key={iv.id} className="flex items-center gap-3 p-2 rounded-md" style={{ background: 'var(--bg-surface)' }}>
                      <span className="text-[14px]">🎯</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{iv.round_type.replace(/_/g, ' ')}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{formatDate(iv.scheduled_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overdue Follow-ups */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                Overdue Follow-ups
                {o.overdueFollowups.length > 0 && (
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#ef4444' }}>{o.overdueFollowups.length}</span>
                )}
              </h2>
            </div>
            <div className="p-4">
              {o.overdueFollowups.length === 0 ? (
                <p className="text-[13px] text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No overdue follow-ups. Great job staying on top!</p>
              ) : (
                <div className="space-y-2">
                  {o.overdueFollowups.map((app) => (
                    <Link key={app.id} href={'/applications?job=' + app.job_id} className="flex items-center gap-3 p-2 rounded-md transition-colors hover:opacity-80" style={{ background: 'var(--bg-surface)' }}>
                      <span className="text-[14px]">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{(app.jobs as any)?.title || 'Untitled'}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{(app.jobs as any)?.company || 'Unknown'} · Last activity: {timeAgo(app.last_activity_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Search Jobs', href: '/search', icon: '🔍', desc: 'Find new opportunities' },
            { label: 'Applications', href: '/applications', icon: '📋', desc: 'Manage your pipeline' },
            { label: 'Ghostwriter', href: '/applications', icon: '✍️', desc: 'AI cover letters & outreach' },
            { label: 'Profile', href: '/profile', icon: '👤', desc: 'Update your CV data' },
          ].map((action) => (
            <Link key={action.label} href={action.href} className="rounded-lg border p-4 transition-colors hover:opacity-90 group" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[16px]">{action.icon}</span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
