'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface JobAlert {
  id: string
  query: string
  location: string | null
  frequency: string
  sources: string[]
  is_active: boolean
  last_sent_at: string | null
  match_count: number
  created_at: string
}

interface NotifPrefs {
  job_alerts: boolean
  application_updates: boolean
  interview_reminders: boolean
  weekly_digest: boolean
  email_frequency: string
}

interface Profile {
  id: string
  email: string
  full_name: string
  headline: string
  location: string
  linkedin_connected?: boolean
  linkedin_first_name?: string
  linkedin_last_name?: string
  linkedin_headline?: string
  linkedin_profile_image_url?: string
}

export default function SettingsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'alerts'>('account')

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileForm, setProfileForm] = useState({ full_name: '', headline: '', location: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinProfile, setLinkedinProfile] = useState<{ name: string; headline: string; imageUrl: string } | null>(null)

  // Notifications
  const [alerts, setAlerts] = useState<JobAlert[]>([])
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [formQuery, setFormQuery] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formFrequency, setFormFrequency] = useState('daily')
  const [prefsSaved, setPrefsSaved] = useState(false)

  // Export / Delete
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [loading, setLoading] = useState(true)
  const [linkedinMessage, setLinkedinMessage] = useState('')

  // Handle LinkedIn OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('linkedin_connected') === 'true'
    const linkedinError = params.get('linkedin_error')

    if (connected) {
      setLinkedinMessage('LinkedIn connected successfully!')
      window.history.replaceState({}, '', '/settings')
      setTimeout(() => setLinkedinMessage(''), 4000)
      // Force re-fetch profile to pick up linkedin_connected
      fetchData()
    } else if (linkedinError) {
      setLinkedinMessage(`LinkedIn connection failed: ${linkedinError}`)
      window.history.replaceState({}, '', '/settings')
      setTimeout(() => setLinkedinMessage(''), 6000)
    }
  }, [])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [profileRes, alertsRes, notifRes] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, headline, location, linkedin_connected, linkedin_first_name, linkedin_last_name, linkedin_headline, linkedin_profile_image_url').eq('id', user.id).single(),
      supabase.from('job_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
    ])

    if (profileRes.data) {
      setProfile(profileRes.data)
      setProfileForm({
        full_name: profileRes.data.full_name || '',
        headline: profileRes.data.headline || '',
        location: profileRes.data.location || '',
      })
      if (profileRes.data.linkedin_connected) {
        setLinkedinConnected(true)
        setLinkedinProfile({
          name: `${profileRes.data.linkedin_first_name || ''} ${profileRes.data.linkedin_last_name || ''}`.trim(),
          headline: profileRes.data.linkedin_headline || '',
          imageUrl: profileRes.data.linkedin_profile_image_url || '',
        })
      }
    }
    if (alertsRes.data) setAlerts(alertsRes.data)
    if (notifRes.data) {
      setPrefs({
        job_alerts: notifRes.data.job_alerts ?? true,
        application_updates: notifRes.data.application_updates ?? true,
        interview_reminders: notifRes.data.interview_reminders ?? true,
        weekly_digest: notifRes.data.weekly_digest ?? true,
        email_frequency: notifRes.data.email_frequency || 'daily',
      })
    } else {
      setPrefs({
        job_alerts: true,
        application_updates: true,
        interview_reminders: true,
        weekly_digest: true,
        email_frequency: 'daily',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Profile ───
  const handleSaveProfile = async () => {
    if (!profile) return
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name.trim(),
      headline: profileForm.headline.trim(),
      location: profileForm.location.trim(),
    }).eq('id', profile.id)
    if (!error) {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    }
  }

  // ─── LinkedIn ───
  const handleLinkedInConnect = async () => {
    try {
      const res = await fetch('/api/auth/linkedin/start')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        alert(data.error || 'Failed to start LinkedIn connection')
      }
    } catch {
      alert('Failed to connect to LinkedIn')
    }
  }

  const handleLinkedInDisconnect = async () => {
    if (!profile) return
    const { error } = await supabase.from('profiles').update({
      linkedin_connected: false,
      linkedin_id: null,
      linkedin_first_name: null,
      linkedin_last_name: null,
      linkedin_headline: null,
      linkedin_summary: null,
      linkedin_profile_url: null,
      linkedin_profile_image_url: null,
      linkedin_raw_profile: null,
      linkedin_token: null,
      linkedin_connected_at: null,
    }).eq('id', profile.id)
    if (!error) {
      setLinkedinConnected(false)
      setLinkedinProfile(null)
      setProfile(p => p ? { ...p, linkedin_connected: false } : p)
    }
  }

  // ─── Export ───
  const handleExport = async () => {
    setExportLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [jobs, applications, resumes, contacts, calendarEvents, outreach] = await Promise.all([
        supabase.from('jobs').select('*').eq('user_id', user.id),
        supabase.from('applications').select('*').eq('user_id', user.id),
        supabase.from('resumes').select('*').eq('user_id', user.id),
        supabase.from('contacts').select('*').eq('user_id', user.id),
        supabase.from('calendar_events').select('*').eq('user_id', user.id),
        supabase.from('outreach_messages').select('*').eq('user_id', user.id),
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: {
          id: user.id,
          email: profile?.email,
          full_name: profileForm.full_name,
          headline: profileForm.headline,
          location: profileForm.location,
        },
        jobs: jobs.data || [],
        applications: applications.data || [],
        resumes: resumes.data || [],
        contacts: contacts.data || [],
        calendar_events: calendarEvents.data || [],
        outreach_messages: outreach.data || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `getautoapply-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportLoading(false)
    }
  }

  // ─── Delete Account ───
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account' }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }
      // Redirect to home after deletion
      window.location.href = '/'
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  // ─── Alerts ───
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !formQuery.trim()) return
    await supabase.from('job_alerts').insert({
      user_id: user.id,
      query: formQuery.trim(),
      location: formLocation.trim() || null,
      frequency: formFrequency,
      sources: ['indeed'],
      is_active: true,
    })
    setFormQuery('')
    setFormLocation('')
    setShowAlertForm(false)
    fetchData()
  }

  const handleDeleteAlert = async (id: string) => {
    await supabase.from('job_alerts').delete().eq('id', id)
    fetchData()
  }

  const handleToggleAlert = async (id: string, active: boolean) => {
    await supabase.from('job_alerts').update({ is_active: active }).eq('id', id)
    fetchData()
  }

  const handleSavePrefs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !prefs) return
    await supabase.from('notification_preferences').upsert({ user_id: user.id, ...prefs })
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2000)
  }

  if (loading) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  }

  const inputStyle: React.CSSProperties = { background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  const tabs = [
    { key: 'account' as const, label: 'Account' },
    { key: 'notifications' as const, label: 'Notifications' },
    { key: 'alerts' as const, label: 'Job Alerts' },
  ]

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-[24px] font-medium tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-[14px] mb-6" style={{ color: 'var(--text-tertiary)' }}>Manage your account, notifications, and preferences</p>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ background: 'var(--bg-panel)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex-1 text-[13px] font-medium px-3 py-2 rounded-md transition-colors"
              style={{
                background: activeTab === t.key ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* LinkedIn message */}
        {linkedinMessage && (
          <div className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
            style={{
              background: linkedinMessage.includes('success') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: linkedinMessage.includes('success') ? '#22c55e' : 'var(--danger)',
              border: `1px solid ${linkedinMessage.includes('success') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
            {linkedinMessage}
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {/* Profile */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[16px] font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Profile</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Email</label>
                  <input type="text" value={profile?.email || ''} disabled
                    className="w-full px-3 py-2 rounded-lg border text-[14px] opacity-60 cursor-not-allowed"
                    style={{ ...inputStyle, borderColor: 'var(--border-subtle)' }} />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Email cannot be changed</p>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Full Name</label>
                  <input type="text" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Headline</label>
                  <input type="text" value={profileForm.headline}
                    onChange={e => setProfileForm(f => ({ ...f, headline: e.target.value }))}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Location</label>
                  <input type="text" value={profileForm.location}
                    onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Austin, TX"
                    className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <button onClick={handleSaveProfile}
                  className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90"
                  style={{ background: 'var(--brand)' }}>
                  {profileSaved ? '✓ Saved' : 'Save Profile'}
                </button>
              </div>
            </div>

            {/* LinkedIn */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[16px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>LinkedIn</h2>
              <p className="text-[12px] mb-4" style={{ color: 'var(--text-quaternary)' }}>
                Connect your LinkedIn account to auto-fill your profile and import job history.
              </p>
              {linkedinConnected && linkedinProfile ? (
                <div className="flex items-center gap-4">
                  {linkedinProfile.imageUrl ? (
                    <img src={linkedinProfile.imageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-medium"
                      style={{ background: '#0A66C2' }}>
                      {linkedinProfile.name.charAt(0) || 'L'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{linkedinProfile.name}</p>
                    {linkedinProfile.headline && (
                      <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{linkedinProfile.headline}</p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: '#22c55e' }}>✓ Connected</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleLinkedInConnect}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:bg-white/[0.03]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Reconnect
                    </button>
                    <button onClick={handleLinkedInDisconnect}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:bg-white/[0.03]"
                      style={{ borderColor: 'rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={handleLinkedInConnect}
                  className="text-[13px] font-medium px-5 py-2.5 rounded-lg text-white inline-flex items-center gap-2 hover:opacity-90"
                  style={{ background: '#0A66C2' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  Connect LinkedIn
                </button>
              )}
            </div>
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-[16px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Export Your Data</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-tertiary)' }}>
                Download a JSON file with all your data — profile, jobs, applications, resumes, contacts, calendar events, and outreach messages.
              </p>
              <button onClick={handleExport} disabled={exportLoading}
                className="text-[13px] font-medium px-5 py-2 rounded-lg border hover:bg-white/[0.03] disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                {exportLoading ? 'Preparing export...' : '⬇ Download My Data (.json)'}
              </button>
            </div>

            {/* Delete Account */}
            <div className="rounded-xl border p-5" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <h2 className="text-[16px] font-medium mb-2" style={{ color: 'var(--danger)' }}>Delete Account</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-tertiary)' }}>
                Permanently delete your account and all associated data. This action cannot be undone. You will be redirected to the homepage.
              </p>
              <div className="mb-3">
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
                  Type DELETE to confirm
                </label>
                <input type="text" value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full max-w-xs px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                  style={{ ...inputStyle, borderColor: 'rgba(239,68,68,0.3)' }} />
              </div>
              {deleteError && <p className="text-[12px] mb-2" style={{ color: 'var(--danger)' }}>{deleteError}</p>}
              <button onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                className="text-[13px] font-medium px-5 py-2 rounded-lg text-white disabled:opacity-30"
                style={{ background: 'var(--danger)' }}>
                {deleteLoading ? 'Deleting...' : 'Delete Account & All Data'}
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ── */}
        {activeTab === 'notifications' && (
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-[16px] font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Notification Preferences</h2>
            {prefs && (
              <div className="space-y-3">
                {[
                  { key: 'job_alerts', label: 'Job Alerts', desc: 'Get notified when new jobs match your saved searches' },
                  { key: 'application_updates', label: 'Application Updates', desc: 'Status changes and reminders' },
                  { key: 'interview_reminders', label: 'Interview Reminders', desc: 'Calendar event reminders' },
                  { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Summary of your job search activity' },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer" style={{ background: 'var(--bg-surface)' }}>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{item.desc}</p>
                    </div>
                    <input type="checkbox" checked={(prefs as any)[item.key]}
                      onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                      style={{ accentColor: 'var(--brand)', width: 18, height: 18 }} />
                  </label>
                ))}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Email Frequency</p>
                  </div>
                  <select value={prefs.email_frequency}
                    onChange={e => setPrefs({ ...prefs, email_frequency: e.target.value })}
                    className="text-[12px] px-2 py-1 rounded border" style={inputStyle}>
                    <option value="realtime">Real-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <button onClick={handleSavePrefs}
                  className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90"
                  style={{ background: 'var(--brand)' }}>
                  {prefsSaved ? '✓ Saved' : 'Save Preferences'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === 'alerts' && (
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-medium" style={{ color: 'var(--text-primary)' }}>Job Alerts</h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>Get emailed when new jobs match your criteria</p>
              </div>
              <button onClick={() => setShowAlertForm(!showAlertForm)}
                className="text-[13px] font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90"
                style={{ background: 'var(--brand)' }}>
                + New Alert
              </button>
            </div>

            {showAlertForm && (
              <form onSubmit={handleCreateAlert} className="mb-4 p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                <input type="text" placeholder="Search query (e.g. 'software engineer')" value={formQuery}
                  onChange={e => setFormQuery(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <input type="text" placeholder="Location (optional)" value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <select value={formFrequency} onChange={e => setFormFrequency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button type="submit" className="text-[13px] font-medium px-4 py-2 rounded-lg text-white"
                  style={{ background: 'var(--brand)' }}>Create Alert</button>
              </form>
            )}

            {alerts.length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: 'var(--text-quaternary)' }}>No alerts yet. Create one to get job matches emailed to you.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between py-3 px-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        &ldquo;{alert.query}&rdquo;
                        {alert.location && <span style={{ color: 'var(--text-quaternary)' }}> in {alert.location}</span>}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>
                        {alert.frequency} · {alert.is_active ? 'Active' : 'Paused'}
                        {alert.last_sent_at && ` · Last sent ${new Date(alert.last_sent_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleAlert(alert.id, !alert.is_active)}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ color: alert.is_active ? '#eab308' : '#22c55e' }}>
                        {alert.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => handleDeleteAlert(alert.id)}
                        className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--danger)' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Extension card — always visible */}
        <div className="rounded-xl border p-5 mt-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-[16px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Chrome Extension</h2>
          <p className="text-[13px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Auto-fill job applications on LinkedIn, Indeed, Greenhouse, Lever, and more.
          </p>
          <div className="flex items-center gap-3">
            <a href="/extension/getautoapply-extension.zip" download
              className="text-[13px] font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 inline-flex items-center gap-2"
              style={{ background: 'var(--brand)' }}>
              📦 Download Extension (.zip)
            </a>
            <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>
              Unzip → chrome://extensions → Load unpacked
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
