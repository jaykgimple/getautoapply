'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  full_name: string;
  professional_headline: string;
  about_me: string;
  location: string;
  personal_website: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  years_experience: number | null;
  desired_job_titles: string[];
  desired_locations: string[];
  remote_preference: string;
  min_salary_usd: number | null;
  visa_sponsorship_needed: boolean;
  core_skills: string[];
  resume_markdown: string;
}

interface WorkItem {
  id: string;
  job_title: string;
  company_name: string;
  location: string;
  role_description: string;
  key_achievements: string[];
  skills_demonstrated: string[];
  tools_used: string[];
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string | null;
}

const EMPTY_PROFILE: Profile = {
  full_name: '', professional_headline: '', about_me: '', location: '',
  personal_website: '', linkedin_url: '', github_url: '', portfolio_url: '',
  years_experience: null, desired_job_titles: [], desired_locations: [],
  remote_preference: 'no_preference', min_salary_usd: null,
  visa_sponsorship_needed: false, core_skills: [], resume_markdown: '',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [eduItems, setEduItems] = useState<EducationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile'|'experience'|'education'|'skills'|'resume'>('profile');
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return }

    const [profileRes, workRes, eduRes] = await Promise.all([
      supabase.from('user_job_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('work_history_items').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('education_history_items').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
    ]);

    if (profileRes.data) setProfile({ ...EMPTY_PROFILE, ...(profileRes.data as any) });
    if (workRes.data) setWorkItems(workRes.data as WorkItem[]);
    if (eduRes.data) setEduItems(eduRes.data as EducationItem[]);
    setLoading(false);
  }, [supabase, EMPTY_PROFILE]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_job_profiles').upsert({
      user_id: user.id,
      ...profile,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddWorkItem = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newItem: any = {
      user_id: user.id,
      job_title: '', company_name: '', location: '',
      role_description: '', key_achievements: [], skills_demonstrated: [],
      tools_used: [], start_date: new Date().toISOString().split('T')[0],
      end_date: null, is_current: false,
    };
    const { data } = await supabase.from('work_history_items').insert(newItem).select().single();
    if (data) setWorkItems([data as WorkItem, ...workItems]);
  };

  const handleUpdateWorkItem = async (id: string, field: string, value: any) => {
    await supabase.from('work_history_items').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    setWorkItems(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleDeleteWorkItem = async (id: string) => {
    if (!confirm('Delete this work entry?')) return;
    await supabase.from('work_history_items').delete().eq('id', id);
    setWorkItems(prev => prev.filter(w => w.id !== id));
  };

  const handleAddEduItem = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('education_history_items').insert({
      user_id: user.id, institution: '', degree: '', field_of_study: '',
      start_date: '', end_date: null,
    }).select().single();
    if (data) setEduItems([data as EducationItem, ...eduItems]);
  };

  const handleUpdateEduItem = async (id: string, field: string, value: any) => {
    await supabase.from('education_history_items').update({ [field]: value }).eq('id', id);
    setEduItems(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleDeleteEduItem = async (id: string) => {
    if (!confirm('Delete this education entry?')) return;
    await supabase.from('education_history_items').delete().eq('id', id);
    setEduItems(prev => prev.filter(e => e.id !== id));
  };

  const handleSkillsChange = (value: string) => {
    setProfile(p => ({ ...p, core_skills: value.split(',').map(s => s.trim()).filter(Boolean) }));
  };

  const handleDesiredTitles = (value: string) => {
    setProfile(p => ({ ...p, desired_job_titles: value.split(',').map(s => s.trim()).filter(Boolean) }));
  };

  if (loading) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading profile...</div>;
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none";
  const inputStyle = { background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' };
  const labelCls = "text-[12px] font-medium block mb-1";
  const labelStyle = { color: 'var(--text-tertiary)' };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            My Profile & CV
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            This data powers your AI-tailored CVs and job matching
          </p>
        </div>
        <button onClick={handleSaveProfile} disabled={saving}
          className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--brand)' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save All'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {(['profile', 'experience', 'education', 'skills', 'resume'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="text-[13px] px-4 py-2.5 border-b-2 transition-colors capitalize"
            style={{
              borderColor: activeTab === tab ? 'var(--brand)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-quaternary)',
            }}>
            {tab === 'resume' ? 'Resume / CV' : tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Full Name</label>
              <input className={inputCls} style={inputStyle} value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} placeholder="Your Name" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Professional Headline</label>
              <input className={inputCls} style={inputStyle} value={profile.professional_headline}
                onChange={e => setProfile(p => ({ ...p, professional_headline: e.target.value }))}
                placeholder="e.g. Full-Stack Engineer | React · Node · TypeScript" />
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>About Me / Professional Summary</label>
            <textarea className={inputCls} style={inputStyle} rows={4} value={profile.about_me}
              onChange={e => setProfile(p => ({ ...p, about_me: e.target.value }))}
              placeholder="2-3 sentences about your career focus, key strengths, and what you're looking for..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Location</label>
              <input className={inputCls} style={inputStyle} value={profile.location}
                onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Years of Experience</label>
              <input type="number" className={inputCls} style={inputStyle}
                value={profile.years_experience ?? ''} onChange={e => setProfile(p => ({ ...p, years_experience: parseInt(e.target.value) || null }))} placeholder="5" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>LinkedIn URL</label>
              <input className={inputCls} style={inputStyle} value={profile.linkedin_url}
                onChange={e => setProfile(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>GitHub URL</label>
              <input className={inputCls} style={inputStyle} value={profile.github_url}
                onChange={e => setProfile(p => ({ ...p, github_url: e.target.value }))} placeholder="https://github.com/..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Remote Preference</label>
              <select className={inputCls} style={inputStyle} value={profile.remote_preference}
                onChange={e => setProfile(p => ({ ...p, remote_preference: e.target.value }))}>
                <option value="no_preference">No Preference</option>
                <option value="remote_only">Remote Only</option>
                <option value="hybrid_ok">Hybrid OK</option>
                <option value="onsite_ok">On-site OK</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Min Salary (USD)</label>
              <input type="number" className={inputCls} style={inputStyle} value={profile.min_salary_usd ?? ''}
                onChange={e => setProfile(p => ({ ...p, min_salary_usd: parseInt(e.target.value) || null }))} placeholder="80000" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.visa_sponsorship_needed}
                  onChange={e => setProfile(p => ({ ...p, visa_sponsorship_needed: e.target.checked }))}
                  className="rounded" />
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Need Visa Sponsorship</span>
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Desired Job Titles (comma-separated)</label>
            <input className={inputCls} style={inputStyle}
              value={(profile.desired_job_titles || []).join(', ')} onChange={e => handleDesiredTitles(e.target.value)}
              placeholder="Software Engineer, Full Stack Developer, Frontend Engineer" />
          </div>
        </div>
      )}

      {/* Experience Tab */}
      {activeTab === 'experience' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>{workItems.length} entries</p>
            <button onClick={handleAddWorkItem} className="text-[13px] px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--brand)' }}>
              + Add Position
            </button>
          </div>
          <div className="space-y-3">
            {workItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>Experience</span>
                  <button onClick={() => handleDeleteWorkItem(item.id)} className="text-[12px]" style={{ color: 'var(--danger)' }}>✕ Delete</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className={inputCls} style={inputStyle} placeholder="Job Title" value={item.job_title}
                    onChange={e => handleUpdateWorkItem(item.id, 'job_title', e.target.value)} />
                  <input className={inputCls} style={inputStyle} placeholder="Company" value={item.company_name}
                    onChange={e => handleUpdateWorkItem(item.id, 'company_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input type="date" className={inputCls} style={inputStyle} value={item.start_date?.split('T')[0] || ''}
                    onChange={e => handleUpdateWorkItem(item.id, 'start_date', e.target.value)} />
                  <input type="date" className={inputCls} style={inputStyle} value={item.end_date?.split('T')[0] || ''}
                    onChange={e => handleUpdateWorkItem(item.id, 'end_date', e.target.value)} disabled={item.is_current} />
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={item.is_current} onChange={e => handleUpdateWorkItem(item.id, 'is_current', e.target.checked)} />
                    Currently working here
                  </label>
                </div>
                <textarea className={`${inputCls} mt-3`} style={inputStyle} rows={3} placeholder="Describe your role and key responsibilities..."
                  value={item.role_description} onChange={e => handleUpdateWorkItem(item.id, 'role_description', e.target.value)} />
                <textarea className={`${inputCls} mt-3`} style={inputStyle} rows={2} placeholder="Key achievements (one per line)..."
                  value={(item.key_achievements || []).join('\n')}
                  onChange={e => handleUpdateWorkItem(item.id, 'key_achievements', e.target.value.split('\n').filter(Boolean))} />
                <input className={`${inputCls} mt-3`} style={inputStyle} placeholder="Skills demonstrated (comma-separated)"
                  value={(item.skills_demonstrated || []).join(', ')}
                  onChange={e => handleUpdateWorkItem(item.id, 'skills_demonstrated', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
              </div>
            ))}
            {workItems.length === 0 && (
              <div className="text-center py-8 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-quaternary)' }}>
                <p className="text-[14px]">No work history added yet</p>
                <p className="text-[12px] mt-1">Add your positions to enable AI-powered CV tailoring</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Education Tab */}
      {activeTab === 'education' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>{eduItems.length} entries</p>
            <button onClick={handleAddEduItem} className="text-[13px] px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--brand)' }}>
              + Add Education
            </button>
          </div>
          <div className="space-y-3">
            {eduItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Education</span>
                  <button onClick={() => handleDeleteEduItem(item.id)} className="text-[12px]" style={{ color: 'var(--danger)' }}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className={inputCls} style={inputStyle} placeholder="Institution" value={item.institution}
                    onChange={e => handleUpdateEduItem(item.id, 'institution', e.target.value)} />
                  <input className={inputCls} style={inputStyle} placeholder="Degree" value={item.degree}
                    onChange={e => handleUpdateEduItem(item.id, 'degree', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input className={inputCls} style={inputStyle} placeholder="Field of Study" value={item.field_of_study}
                    onChange={e => handleUpdateEduItem(item.id, 'field_of_study', e.target.value)} />
                  <input type="date" className={inputCls} style={inputStyle} value={item.start_date?.split('T')[0] || ''}
                    onChange={e => handleUpdateEduItem(item.id, 'start_date', e.target.value)} />
                  <input type="date" className={inputCls} style={inputStyle} value={item.end_date?.split('T')[0] || ''}
                    onChange={e => handleUpdateEduItem(item.id, 'end_date', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div>
            <label className={labelCls} style={labelStyle}>Core Skills (comma-separated)</label>
            <input className={inputCls} style={inputStyle}
              value={(profile.core_skills || []).join(', ')} onChange={e => handleSkillsChange(e.target.value)}
              placeholder="JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, AWS, Docker" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(profile.core_skills || []).map(skill => (
                <span key={skill} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Desired Job Titles (for matching)</label>
            <input className={inputCls} style={inputStyle}
              value={(profile.desired_job_titles || []).join(', ')} onChange={e => handleDesiredTitles(e.target.value)}
              placeholder="Software Engineer, Senior Developer, Tech Lead" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Preferred Locations</label>
            <input className={inputCls} style={inputStyle}
              value={(profile.desired_locations || []).join(', ')}
              onChange={e => setProfile(p => ({ ...p, desired_locations: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) }))}
              placeholder="London, Berlin, Remote, New York" />
          </div>
        </div>
      )}

      {/* Resume Tab */}
      {activeTab === 'resume' && (
        <div className="space-y-4">
          <div>
            <label className={labelCls} style={labelStyle}>Resume / CV (Markdown)</label>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-quaternary)' }}>
              Write your resume in Markdown. This is used as the base for AI-tailored CVs.
            </p>
            <textarea className={inputCls} style={{ ...inputStyle, fontFamily: 'monospace', minHeight: '400px' }}
              value={profile.resume_markdown}
              onChange={e => setProfile(p => ({ ...p, resume_markdown: e.target.value }))}
              placeholder={"# Your Name\n## Professional Summary\nExperienced software engineer with 5+ years...\n\n## Experience\n### Senior Engineer at Company A (2022-Present)\n- Led migration to microservices...\n- Reduced latency by 40%...\n\n### Engineer at Company B (2019-2022)\n- Built real-time data pipeline...\n\n## Skills\nJavaScript, TypeScript, React, Node.js, Python, AWS\n\n## Education\nBSc Computer Science, University of..."} />
          </div>
        </div>
      )}
    </div>
  );
}
