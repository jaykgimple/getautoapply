'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TrackedApp {
  id: string;
  job_id: string;
  pipeline_stage: string;
  applied_at: string | null;
  last_activity_at: string | null;
  is_starred: boolean;
  user_notes: string | null;
  outcome: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    job_url: string | null;
    description: string | null;
    source: string;
    salary_min: number | null;
    salary_max: number | null;
    is_remote: boolean;
    match_score_ai: number | null;
    match_reasoning: string | null;
    tailored_summary: string | null;
    tailored_headline: string | null;
    visa_sponsor_score: number | null;
  };
}

interface Interview {
  id: string;
  round_number: number;
  round_type: string;
  scheduled_at: string | null;
  outcome: string | null;
}

const STAGES = [
  { key: 'saved',     label: 'Saved',       color: '#9ca3af' },
  { key: 'applied',   label: 'Applied',     color: '#5e6ad2' },
  { key: 'screening', label: 'Screening',   color: '#eab308' },
  { key: 'interviewing', label: 'Interviewing', color: '#a855f7' },
  { key: 'offer',     label: 'Offer',       color: '#22c55e' },
  { key: 'accepted',  label: 'Accepted',    color: '#10b981' },
  { key: 'rejected',  label: 'Rejected',    color: '#ef4444' },
  { key: 'ghosted',   label: 'Ghosted',     color: '#6b7280' },
  { key: 'withdrawn', label: 'Withdrawn',   color: '#6b7280' },
];

const STAGE_SET = new Set(STAGES.map(s => s.key));

function sanitizeHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function getStageColor(stageKey: string): string {
  return STAGES.find(s => s.key === stageKey)?.color || '#9ca3af';
}

function MatchBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const cls = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-[11px] font-bold ${cls}`}>{score}%</span>;
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<TrackedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<TrackedApp | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addCompany, setAddCompany] = useState('');
  const [addStage, setAddStage] = useState('saved');
  const [addNotes, setAddNotes] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<Record<string, Interview[]>>({});
  const [showInterviewForm, setShowInterviewForm] = useState<string | null>(null);
  const [intDate, setIntDate] = useState('');
  const [intType, setIntType] = useState('video');
  const [intNotes, setIntNotes] = useState('');

  const supabase = createClient();

  const loadApps = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('tracked_applications')
      .select(`*, job:jobs(*)`)
      .eq('user_id', user.id)
      .order('last_activity_at', { ascending: false })
      .limit(200);

    if (error) { console.error(error); setLoading(false); return }

    const typed = data as unknown as TrackedApp[];
    setApps(typed);

    // Load interviews for all apps
    const appIds = typed.map(a => a.id);
    if (appIds.length > 0 && appIds[0]) {
      const { data: ints } = await supabase
        .from('interview_rounds')
        .select('*')
        .in('application_id', appIds)
        .order('scheduled_at', { ascending: true });
      if (ints) {
        const grouped: Record<string, Interview[]> = {};
        (ints as Interview[]).forEach((i: Interview) => {
          const appId = (i as any).application_id;
          if (!grouped[appId]) grouped[appId] = [];
          grouped[appId].push(i);
        });
        setInterviews(grouped);
      }
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadApps(); }, [loadApps]);

  const getAppsByStage = (stage: string) =>
    apps.filter(a => (a.pipeline_stage || 'saved') === stage && STAGE_SET.has(a.pipeline_stage || 'saved'));

  const handleStageChange = async (appId: string, newStage: string) => {
    const updates: Record<string, unknown> = {
      pipeline_stage: newStage,
      last_activity_at: new Date().toISOString(),
    };
    if (newStage === 'applied' && !apps.find(a => a.id === appId)?.applied_at) {
      updates.applied_at = new Date().toISOString();
    }
    await supabase.from('tracked_applications').update(updates).eq('id', appId);
    loadApps();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this application from tracking?')) return;
    await supabase.from('tracked_applications').delete().eq('id', id);
    if (selectedApp?.id === id) setSelectedApp(null);
    loadApps();
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find or create job
      let jobId = '';
      if (addUrl) {
        const { data: existing } = await supabase
          .from('jobs').select('id').eq('job_url', addUrl).limit(1).single();
        if (existing) { jobId = (existing as any).id; }
      }
      if (!jobId) {
        const { data: newJob } = await supabase.from('jobs').insert({
          title: addTitle || 'Untitled Position',
          company: addCompany || 'Unknown Company',
          job_url: addUrl || null,
          source: 'manual_entry',
          description: '',
        }).select('id').single();
        if (newJob) jobId = (newJob as any).id;
      }
      if (!jobId) throw new Error('Could not create job');

      await supabase.from('tracked_applications').insert({
        user_id: user.id,
        job_id: jobId,
        pipeline_stage: addStage,
        user_notes: addNotes || null,
        applied_at: addStage === 'applied' ? new Date().toISOString() : null,
      });

      setShowAddForm(false);
      setAddUrl(''); setAddTitle(''); setAddCompany(''); setAddNotes('');
      loadApps();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add');
    }
    setAddLoading(false);
  };

  const handleEnrich = async (jobId: string) => {
    setEnriching(jobId);
    try {
      const { data: profile } = await supabase.from('user_job_profiles').select('*').single();
      const resumeData = profile ? {
        fullName: profile.full_name || 'Candidate',
        headline: profile.professional_headline || '',
        summary: profile.about_me || '',
        skills: profile.core_skills || [],
        experience: [] as any[],
        education: [] as any[],
      } : { fullName: 'Candidate', headline: '', summary: '', skills: [], experience: [], education: [] };

      await fetch('/api/jobs/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, resumeData }),
      });
      loadApps();
    } catch (err) { console.error('Enrich failed:', err); }
    setEnriching(null);
  };

  const handleAddInterview = async (e: React.FormEvent, appId: string) => {
    e.preventDefault();
    if (!intDate) return;
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    await supabase.from('interview_rounds').insert({
      application_id: appId,
      job_id: app.job_id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      round_number: (interviews[appId]?.length || 0) + 1,
      round_type: intType,
      scheduled_at: new Date(intDate).toISOString(),
      prep_notes: intNotes,
    });
    setShowInterviewForm(null);
    setIntDate(''); setIntNotes('');
    loadApps();
  };

  // Stats
  const total = apps.length;
  const inPipeline = apps.filter(a => !['rejected','withdrawn','ghosted','accepted'].includes(a.pipeline_stage || '')).length;
  const interviewing = apps.filter(a => a.pipeline_stage === 'interviewing').length;
  const offers = apps.filter(a => ['offer','accepted'].includes(a.pipeline_stage || '')).length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading pipeline...</p>
      </div>
    );
  }

  const stageApps = selectedApp ? null : null;  // used below

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Application Pipeline
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {total} tracked · {inPipeline} active · {interviewing} interviewing · {offers} offers
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2"
            style={{ background: 'var(--brand)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Track Job
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>Track a New Position</h3>
              <button onClick={() => setShowAddForm(false)} style={{ color: 'var(--text-quaternary)' }}>✕</button>
            </div>
            {addError && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{addError}</p>}
            <form onSubmit={handleAddManual} className="space-y-3">
              <input placeholder="Job URL (optional)" value={addUrl} onChange={e => setAddUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <div className="flex gap-3">
                <input placeholder="Job title" value={addTitle} onChange={e => setAddTitle(e.target.value)} required
                  className="flex-1 px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                <input placeholder="Company" value={addCompany} onChange={e => setAddCompany(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <select value={addStage} onChange={e => setAddStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <textarea placeholder="Notes (optional)" value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={addLoading || !addTitle}
                className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                {addLoading ? 'Adding...' : 'Track Position'}
              </button>
            </form>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-6">
          {STAGES.map((stage) => {
            const stageAppsList = getAppsByStage(stage.key);
            return (
              <div key={stage.key} className="flex-shrink-0 w-[280px] rounded-lg border"
                style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                {/* Column header */}
                <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-[13px] font-medium" style={{ color: stage.color }}>{stage.label}</span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-quaternary)' }}>
                    {stageAppsList.length}
                  </span>
                </div>
                {/* Cards */}
                <div className="p-2 min-h-[200px] space-y-2">
                  {stageAppsList.map((app) => (
                    <div key={app.id}
                      className="rounded-lg border p-3 cursor-pointer hover:border-white/20 transition-colors group"
                      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                      onClick={() => setSelectedApp(app)}>
                      {/* Star */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium mb-0.5 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                            {app.job?.title || 'Unknown'}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>
                            {app.job?.company || ''}
                          </p>
                        </div>
                        <MatchBadge score={app.job?.match_score_ai ?? null} />
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {app.job?.is_remote && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Remote</span>
                        )}
                        {app.job?.visa_sponsor_score && app.job.visa_sponsor_score > 0.5 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>Visa</span>
                        )}
                        {app.is_starred && <span className="text-[10px]">⭐</span>}
                        {interviews[app.id] && interviews[app.id].length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>
                            {interviews[app.id].length} interview{interviews[app.id].length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Tailored summary preview */}
                      {app.job?.tailored_headline && (
                        <p className="text-[11px] mt-2 line-clamp-1 italic" style={{ color: 'var(--text-tertiary)' }}>
                          {app.job.tailored_headline}
                        </p>
                      )}

                      {/* Quick stage change + actions */}
                      <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <select
                          value={app.pipeline_stage || ''}
                          onChange={e => handleStageChange(app.id, e.target.value)}
                          className="text-[11px] px-1.5 py-0.5 rounded border focus:outline-none"
                          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          {!app.job?.match_score_ai && (
                            <button onClick={() => app.job && handleEnrich(app.job.id)}
                              disabled={enriching === app.job?.id}
                              className="text-[11px] px-2 py-0.5 rounded hover:opacity-80 disabled:opacity-50"
                              style={{ background: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                              {enriching === app.job?.id ? '...' : 'Score'}
                            </button>
                          )}
                          <button onClick={() => handleDelete(app.id)}
                            className="text-[11px] opacity-60 hover:opacity-100" style={{ color: 'var(--danger)' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {stageAppsList.length === 0 && (
                    <p className="text-[12px] text-center py-6" style={{ color: 'var(--text-quaternary)' }}>No jobs</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel (slides in from right or modal) */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedApp(null)}>
            <div className="rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-[20px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{selectedApp.job?.title}</h2>
                    <p style={{ color: 'var(--text-tertiary)' }}>{selectedApp.job?.company} {selectedApp.job?.location && `· ${selectedApp.job.location}`}</p>
                  </div>
                  <button onClick={() => setSelectedApp(null)} style={{ color: 'var(--text-quaternary)' }} className="text-xl">×</button>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {selectedApp.job?.is_remote && <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Remote</span>}
                  {selectedApp.job?.match_score_ai !== null && selectedApp.job?.match_score_ai !== undefined && (
                    <span className={`text-xs px-2 py-1 rounded ${selectedApp.job.match_score_ai >= 75 ? 'bg-green-500/12 text-green-400' : selectedApp.job.match_score_ai >= 50 ? 'bg-yellow-500/12 text-yellow-400' : 'bg-red-500/12 text-red-400'}`}>
                      Match: {selectedApp.job.match_score_ai}%
                    </span>
                  )}
                  {selectedApp.job?.visa_sponsor_score && selectedApp.job.visa_sponsor_score > 0.5 && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>Visa Sponsor</span>
                  )}
                  {selectedApp.job?.job_url && (
                    <a href={selectedApp.job.job_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ background: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                      Apply Link ↗
                    </a>
                  )}
                </div>

                {/* AI Enrich */}
                {!selectedApp.job?.tailored_summary && (
                  <button
                    onClick={() => selectedApp.job && handleEnrich(selectedApp.job.id)}
                    disabled={enriching === selectedApp.job?.id}
                    className="w-full mb-4 text-[14px] px-4 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'rgba(94,106,210,0.15)', color: '#5e6ad2', border: '1px solid rgba(94,106,210,0.3)' }}>
                    {enriching === selectedApp.job?.id ? '⏳ Analyzing...' : '✨ Analyze My Fit & Generate Tailored CV'}
                  </button>
                )}

                {/* Tailored summary */}
                {selectedApp.job?.tailored_summary && (
                  <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(94,106,210,0.05)', border: '1px solid rgba(94,106,210,0.2)' }}>
                    <h4 className="text-[12px] font-semibold mb-2" style={{ color: '#5e6ad2' }}>AI-TAILORED CANDIDATE PROFILE</h4>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selectedApp.job.tailored_summary}</p>
                    {selectedApp.job.tailored_headline && (
                      <p className="text-[12px] mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>{selectedApp.job.tailored_headline}</p>
                    )}
                    {selectedApp.job.match_reasoning && (
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-quaternary)' }}>💡 {selectedApp.job.match_reasoning}</p>
                    )}
                  </div>
                )}

                {/* Match score visual */}
                {selectedApp.job?.match_score_ai !== null && selectedApp.job?.match_score_ai !== undefined && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Fit Score</span>
                      <span className="text-[14px] font-bold" style={{ color: getStageColor(selectedApp.pipeline_stage || 'saved') }}>{selectedApp.job.match_score_ai}/100</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${selectedApp.job.match_score_ai}%`,
                        background: selectedApp.job.match_score_ai >= 75 ? '#22c55e' : selectedApp.job.match_score_ai >= 50 ? '#eab308' : '#ef4444',
                      }} />
                    </div>
                  </div>
                )}

                {/* Stage selector */}
                <div className="mb-4">
                  <label className="text-[12px] block mb-2" style={{ color: 'var(--text-quaternary)' }}>Pipeline Stage</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {STAGES.map(stage => (
                      <button
                        key={stage.key}
                        onClick={() => handleStageChange(selectedApp.id, stage.key)}
                        className="text-[12px] px-3 py-1.5 rounded-md border transition-colors"
                        style={{
                          background: (selectedApp.pipeline_stage || '') === stage.key ? `${stage.color}22` : 'var(--bg-surface)',
                          borderColor: (selectedApp.pipeline_stage || '') === stage.key ? stage.color : 'var(--border-subtle)',
                          color: (selectedApp.pipeline_stage || '') === stage.key ? stage.color : 'var(--text-quaternary)',
                        }}>
                        {stage.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interviews */}
                <div className="mb-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      Interviews ({interviews[selectedApp.id]?.length || 0})
                    </h4>
                    <button onClick={() => setShowInterviewForm(showInterviewForm === selectedApp.id ? null : selectedApp.id)}
                      className="text-[12px] px-3 py-1 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                      + Schedule
                    </button>
                  </div>
                  {showInterviewForm === selectedApp.id && (
                    <form onSubmit={e => handleAddInterview(e, selectedApp.id)} className="space-y-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                      <div className="flex gap-2">
                        <input type="datetime-local" value={intDate} onChange={e => setIntDate(e.target.value)} required
                          className="flex-1 px-2 py-1.5 rounded border text-[12px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                        <select value={intType} onChange={e => setIntType(e.target.value)}
                          className="px-2 py-1.5 rounded border text-[12px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                          <option value="recruiter_screen">Recruiter Screen</option>
                          <option value="hiring_manager">Hiring Manager</option>
                          <option value="technical_screen">Technical Screen</option>
                          <option value="coding_challenge">Coding Challenge</option>
                          <option value="system_design">System Design</option>
                          <option value="behavioral">Behavioral</option>
                          <option value="panel">Panel</option>
                          <option value="onsite">Onsite</option>
                          <option value="final">Final Round</option>
                        </select>
                      </div>
                      <textarea placeholder="Prep notes..." value={intNotes} onChange={e => setIntNotes(e.target.value)} rows={2}
                        className="w-full px-2 py-1.5 rounded border text-[12px] focus:outline-none resize-y" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      <button type="submit" className="text-[12px] px-4 py-1.5 rounded text-white" style={{ background: '#a855f7' }}>Save</button>
                    </form>
                  )}
                  {interviews[selectedApp.id]?.map((interview, idx) => (
                    <div key={interview.id} className="text-[12px] mb-1.5 p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Round {idx + 1}: {interview.round_type.replace(/_/g, ' ')}</span>
                      {interview.scheduled_at && (
                        <span className="ml-2" style={{ color: 'var(--text-quaternary)' }}>
                          {new Date(interview.scheduled_at).toLocaleDateString()} {new Date(interview.scheduled_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </span>
                      )}
                      {interview.outcome && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>{interview.outcome}</span>}
                    </div>
                  ))}
                  {(!interviews[selectedApp.id] || interviews[selectedApp.id].length === 0) && !showInterviewForm && (
                    <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>No interviews scheduled</p>
                  )}
                </div>

                {/* Job description */}
                {selectedApp.job?.description && (
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h4 className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-quaternary)' }}>JOB DESCRIPTION</h4>
                    <div className="description-html text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedApp.job.description) }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
