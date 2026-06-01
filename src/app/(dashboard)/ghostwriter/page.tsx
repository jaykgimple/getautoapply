'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  job_url: string;
  description: string;
  match_score_ai: number | null;
  tailored_headline: string | null;
  visa_sponsor_score: number | null;
  source: string;
}

interface GhostwriterMode {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const MODES: GhostwriterMode[] = [
  { key: 'cover_letter', label: 'Cover Letter', icon: '📝', description: 'Tailored cover letter for this job' },
  { key: 'outreach', label: 'LinkedIn Outreach', icon: '🔗', description: 'Message to recruiter or hiring manager' },
  { key: 'interview_prep', label: 'Interview Prep', icon: '🎯', description: 'Key talking points and likely questions' },
  { key: 'followup', label: 'Follow-up Email', icon: '📧', description: 'Post-interview or post-application follow-up' },
  { key: 'negotiation', label: 'Salary Negotiation', icon: '💰', description: 'Salary/offer negotiation script' },
  { key: 'resume_bullet', label: 'Resume Bullets', icon: '•', description: 'Tailored resume bullet points' },
  { key: 'thankyou', label: 'Thank You Note', icon: '🙏', description: 'Post-interview thank you' },
  { key: 'company_research', label: 'Company Research', icon: '🔍', description: 'Key things to know beforeInterview' },
];

export default function GhostwriterPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedMode, setSelectedMode] = useState('cover_letter');
  const [context, setContext] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setJobsLoading(false); return; }

    const { data } = await supabase
      .from('tracked_applications')
      .select('job_id, jobs(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const jobList = data.map((d: any) => d.jobs).filter(Boolean);
      setJobs(jobList);
      if (jobList.length > 0 && !selectedJob) setSelectedJob(jobList[0]);
    }
    setJobsLoading(false);
  }, [selectedJob]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const generate = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setOutput('');
    try {
      const res = await fetch('/api/jobs/ghostwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          mode: selectedMode,
          context: context || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setOutput('Error: ' + data.error);
      } else {
        setOutput(data.content || 'No output generated');
      }
    } catch (e: any) {
      setOutput('Error: ' + (e.message || 'Request failed'));
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = searchQuery
    ? jobs.filter(j => (j.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (j.company || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : jobs;

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Left sidebar: Job list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>Ghostwriter</h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>AI-powered job application assistant</p>
        </div>
        <div className="px-3 py-2">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[12px] px-3 py-1.5 rounded-md border outline-none"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex-1 overflow-auto px-2 py-1 space-y-0.5">
          {jobsLoading ? (
            <p className="text-[12px] text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-[12px] text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No tracked jobs yet. Save some jobs first.</p>
          ) : (
            filteredJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => { setSelectedJob(job); setOutput(''); }}
                className="w-full text-left px-3 py-2 rounded-md transition-colors text-[12px]"
                style={{
                  background: selectedJob?.id === job.id ? 'var(--bg-surface)' : 'transparent',
                  color: selectedJob?.id === job.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <p className="font-medium truncate">{job.title || 'Untitled'}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-quaternary)' }}>{job.company || 'Unknown'}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {selectedJob ? (
          <>
            {/* Job header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}>
              <h1 className="text-[18px] font-medium" style={{ color: 'var(--text-primary)' }}>{selectedJob.title || 'Untitled'}</h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {selectedJob.company || 'Unknown'} · {selectedJob.location || 'Remote'}
                {selectedJob.match_score_ai != null && (
                  <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" style={{ background: Number(selectedJob.match_score_ai) > 60 ? '#22c55e20' : '#eab30820', color: Number(selectedJob.match_score_ai) > 60 ? '#22c55e' : '#eab308' }}>
                    Match: {selectedJob.match_score_ai}%
                  </span>
                )}
              </p>
            </div>

            {/* Mode selector */}
            <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => { setSelectedMode(mode.key); setOutput(''); }}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                    style={{
                      background: selectedMode === mode.key ? 'var(--brand)' : 'var(--bg-surface)',
                      color: selectedMode === mode.key ? '#fff' : 'var(--text-secondary)',
                      border: selectedMode === mode.key ? '1px solid var(--brand)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <span>{mode.icon}</span>
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-quaternary)' }}>
                {MODES.find(m => m.key === selectedMode)?.description}
              </p>
            </div>

            {/* Context input */}
            <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Additional context (optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. I have 5 years of React experience. The interview is with the VP of Engineering. I want to emphasize my team leadership..."
                rows={2}
                className="w-full text-[13px] px-3 py-2 rounded-md border outline-none resize-none"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={generate}
                disabled={loading}
                className="mt-2 text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {/* Output */}
            <div className="flex-1 px-6 py-4 overflow-auto">
              {output ? (
                <div className="rounded-lg border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{selectedMode.replace(/_/g, ' ')}</h3>
                    <button
                      onClick={() => navigator.clipboard.writeText(output)}
                      className="text-[11px] font-medium px-2 py-1 rounded transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-[13px] whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{output}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-[32px] mb-3">✍️</p>
                    <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Select a mode and click Generate</p>
                    <p className="text-[12px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Your AI-generated content will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-[32px] mb-3">✍️</p>
              <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Select a job from the sidebar</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Or <a href="/search" className="hover:underline" style={{ color: 'var(--brand-bright)' }}>search for jobs</a> to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
