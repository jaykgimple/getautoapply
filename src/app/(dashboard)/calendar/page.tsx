'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_type: string
  start_time: string
  end_time: string
  location: string | null
  job_id: string | null
  reminder_minutes: number
  notes: string | null
  is_completed: boolean
  jobs?: { title: string; company_name: string }
}

const EVENT_TYPE_CONFIG: Record<string, { color: string; emoji: string; label: string }> = {
  interview:  { color: '#eab308', emoji: '🎯', label: 'Interview' },
  follow_up:  { color: '#5e6ad2', emoji: '📤', label: 'Follow Up' },
  deadline:   { color: '#ef4444', emoji: '⏰', label: 'Deadline' },
  networking: { color: '#22c55e', emoji: '🤝', label: 'Networking' },
  other:      { color: '#a855f7', emoji: '📌', label: 'Other' },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [filter, setFilter] = useState('all')
  const [jobs, setJobs] = useState<{ id: string; title: string; company_name: string }[]>([])
  const supabase = createClient()

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('interview')
  const [formDate, setFormDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formLocation, setFormLocation] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formJobId, setFormJobId] = useState('')
  const [formReminder, setFormReminder] = useState(15)

  const fetchEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [eventsRes, jobsRes] = await Promise.all([
      supabase.from('calendar_events')
        .select('*, jobs(title, company_name)')
        .eq('user_id', user.id)
        .gte('start_time', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('start_time', { ascending: true }),
      supabase.from('jobs').select('id, title, company_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ])
    if (eventsRes.data) setEvents(eventsRes.data)
    if (jobsRes.data) setJobs(jobsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const resetForm = () => {
    setFormTitle(''); setFormType('interview'); setFormDate('')
    setFormStartTime('09:00'); setFormEndTime('10:00')
    setFormLocation(''); setFormNotes(''); setFormJobId('')
    setFormReminder(15); setEditEvent(null); setShowForm(false)
  }

  const handleEdit = (event: CalendarEvent) => {
    setEditEvent(event)
    setFormTitle(event.title)
    setFormType(event.event_type)
    setFormDate(new Date(event.start_time).toISOString().split('T')[0])
    setFormStartTime(formatTime(event.start_time).replace(/(AM|PM)/, '').trim())
    setFormEndTime(formatTime(event.end_time).replace(/(AM|PM)/, '').trim())
    setFormLocation(event.location || '')
    setFormNotes(event.notes || '')
    setFormJobId(event.job_id || '')
    setFormReminder(event.reminder_minutes)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle || !formDate) return

    const start = new Date(`${formDate}T${formStartTime}`).toISOString()
    const end = new Date(`${formDate}T${formEndTime}`).toISOString()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editEvent) {
      await supabase.from('calendar_events').update({
        title: formTitle, event_type: formType,
        start_time: start, end_time: end,
        location: formLocation || null, notes: formNotes || null,
        reminder_minutes: formReminder,
      }).eq('id', editEvent.id)
    } else {
      await supabase.from('calendar_events').insert({
        user_id: user.id, title: formTitle, event_type: formType,
        start_time: start, end_time: end,
        location: formLocation || null, notes: formNotes || null,
        job_id: formJobId || null,
        reminder_minutes: formReminder,
      })
    }

    resetForm()
    fetchEvents()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    fetchEvents()
  }

  const handleComplete = async (id: string, completed: boolean) => {
    await supabase.from('calendar_events').update({ is_completed: completed }).eq('id', id)
    fetchEvents()
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter)
  const upcoming = filtered.filter(e => !e.is_completed && new Date(e.start_time) >= new Date())
  const past = filtered.filter(e => e.is_completed || new Date(e.end_time) < new Date())

  const inputStyle: React.CSSProperties = { background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Calendar</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Track interviews, follow-ups, and deadlines
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }}
            className="text-[13px] font-medium px-4 py-2 rounded-lg text-white hover:opacity-90"
            style={{ background: 'var(--brand)' }}>
            + Add Event
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {['all', ...Object.keys(EVENT_TYPE_CONFIG)].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-[12px] px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: filter === f ? 'var(--brand)' : 'var(--bg-panel)',
                color: filter === f ? 'white' : 'var(--text-tertiary)',
              }}>
              {f === 'all' ? 'All' : EVENT_TYPE_CONFIG[f]?.label || f}
            </button>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {editEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <button onClick={resetForm} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Event title *" value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle}>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <div className="flex items-center gap-2">
                  <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                  <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>→</span>
                  <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <input type="text" placeholder="Location (optional)" value={formLocation} onChange={e => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle} />
                <select value={formJobId} onChange={e => setFormJobId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={inputStyle}>
                  <option value="">Link to job...</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>)}
                </select>
              </div>
              <textarea placeholder="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y" style={inputStyle} />
              <div className="flex items-center gap-3">
                <label className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Reminder:</label>
                <select value={formReminder} onChange={e => setFormReminder(Number(e.target.value))}
                  className="px-2 py-1 rounded border text-[12px]" style={inputStyle}>
                  <option value={5}>5 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
              <button type="submit" className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90"
                style={{ background: 'var(--brand)' }}>
                {editEvent ? 'Update Event' : 'Create Event'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Loading events...</div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-quaternary)' }}>
                  Upcoming ({upcoming.length})
                </h2>
                <div className="space-y-2">
                  {upcoming.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other
                    return (
                      <div key={event.id} className="rounded-lg border p-4 flex items-start gap-4 group"
                        style={{ background: 'var(--bg-panel)', borderColor: `${config.color}30` }}>
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[18px]"
                            style={{ background: `${config.color}15` }}>
                            {config.emoji}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</h3>
                          </div>
                          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                            {formatDateTime(event.start_time)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            {event.location ? ` · ${event.location}` : ''}
                            {event.jobs ? ` · ${event.jobs.company_name}` : ''}
                          </p>
                          {event.notes && <p className="text-[12px] mt-1" style={{ color: 'var(--text-quaternary)' }}>{event.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleComplete(event.id, true)} className="text-[11px] px-2 py-1 rounded" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}>✓</button>
                          <button onClick={() => handleEdit(event)} className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--text-tertiary)' }}>Edit</button>
                          <button onClick={() => handleDelete(event.id)} className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--danger)' }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-quaternary)' }}>
                  Past ({past.length})
                </h2>
                <div className="space-y-2">
                  {past.slice(0, 10).map(event => {
                    const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other
                    return (
                      <div key={event.id} className="rounded-lg border p-3 flex items-center gap-3 opacity-60"
                        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                        <span className="text-[14px]">{config.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>
                            {formatDateTime(event.start_time)}
                            {event.jobs ? ` · ${event.jobs.company_name}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: event.is_completed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: event.is_completed ? '#22c55e' : '#ef4444' }}>
                          {event.is_completed ? '✓ Done' : 'Missed'}
                        </span>
                        <button onClick={() => handleDelete(event.id)} className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <span className="text-[32px]">📅</span>
                <p className="text-[14px] font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>No events yet</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-quaternary)' }}>
                  Add interviews, follow-ups, and deadlines to stay organized
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
