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

export default function SettingsPage() {
  const [alerts, setAlerts] = useState<JobAlert[]>([])
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [formQuery, setFormQuery] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formFrequency, setFormFrequency] = useState('daily')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [alertsRes] = await Promise.all([
      supabase.from('job_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (alertsRes.data) setAlerts(alertsRes.data)
    setPrefs({
      job_alerts: true,
      application_updates: true,
      interview_reminders: true,
      weekly_digest: true,
      email_frequency: 'daily',
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
    await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      ...prefs,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  }

  const inputStyle: React.CSSProperties = { background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-[24px] font-medium tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-[14px] mb-8" style={{ color: 'var(--text-tertiary)' }}>Notifications, alerts, and preferences</p>

        {/* Notification Preferences */}
        <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
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
                  <input
                    type="checkbox"
                    checked={(prefs as any)[item.key]}
                    onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                    style={{ accentColor: 'var(--brand)', width: 18, height: 18 }}
                  />
                </label>
              ))}
              <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Email Frequency</p>
                </div>
                <select
                  value={prefs.email_frequency}
                  onChange={e => setPrefs({ ...prefs, email_frequency: e.target.value })}
                  className="text-[12px] px-2 py-1 rounded border"
                  style={inputStyle}
                >
                  <option value="realtime">Real-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <button onClick={handleSavePrefs}
                className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90"
                style={{ background: 'var(--brand)' }}>
                {saved ? '✓ Saved' : 'Save Preferences'}
              </button>
            </div>
          )}
        </div>

        {/* Job Alerts */}
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

        {/* Extension */}
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
