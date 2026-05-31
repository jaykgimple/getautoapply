'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  getDay,
  getDate,
} from 'date-fns'

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

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string; label: string; emoji: string }> = {
  interview:  { bg: 'rgba(234,179,8,0.12)',  text: '#eab308', dot: '#eab308', label: 'Interview',  emoji: '🎯' },
  follow_up:  { bg: 'rgba(94,106,210,0.12)', text: '#828fff', dot: '#5e6ad2', label: 'Follow Up', emoji: '📤' },
  deadline:   { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', dot: '#ef4444', label: 'Deadline',  emoji: '⏰' },
  networking: { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', dot: '#22c55e', label: 'Networking',emoji: '🤝' },
  other:      { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', dot: '#a855f7', label: 'Other',     emoji: '📌' },
}

function formatTime12(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ─── Build a proper calendar grid ───
// Always 6 rows × 7 cols, Sunday-first (col 0 = Sun, col 6 = Sat)
function buildCalendarGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)

  // Start from the Sunday of the week containing the 1st of the month
  let start = new Date(first)
  const dayOfWeek = start.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  start.setDate(start.getDate() - dayOfWeek) // go back to Sunday

  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(start))
      start.setDate(start.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [filter, setFilter] = useState('all')
  const [jobs, setJobs] = useState<{ id: string; title: string; company_name: string }[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const supabase = createClient()

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
    const start = subMonths(new Date(), 2).toISOString()
    const end = addMonths(new Date(), 6).toISOString()
    const [eventsRes, jobsRes] = await Promise.all([
      supabase.from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time', { ascending: true }),
      supabase.from('jobs').select('id, title, company_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ])
    console.log('Fetch events:', { userId: user.id, count: eventsRes.data?.length, error: eventsRes.error })
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
    setFormDate(format(new Date(event.start_time), 'yyyy-MM-dd'))
    setFormStartTime(format(new Date(event.start_time), 'HH:mm'))
    setFormEndTime(format(new Date(event.end_time), 'HH:mm'))
    setFormLocation(event.location || '')
    setFormNotes(event.notes || '')
    setFormJobId(event.job_id || '')
    setFormReminder(event.reminder_minutes)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle || !formDate) return
    setFormLoading(true)
    const start = new Date(`${formDate}T${formStartTime}`).toISOString()
    const end = new Date(`${formDate}T${formEndTime}`).toISOString()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormLoading(false); return }

    let error
    if (editEvent) {
      const result = await supabase.from('calendar_events').update({
        title: formTitle, event_type: formType, start_time: start, end_time: end,
        location: formLocation || null, notes: formNotes || null,
        reminder_minutes: formReminder, job_id: formJobId || null,
      }).eq('id', editEvent.id)
      error = result.error
    } else {
      const result = await supabase.from('calendar_events').insert({
        user_id: user.id, title: formTitle, event_type: formType, start_time: start, end_time: end,
        location: formLocation || null, notes: formNotes || null,
        job_id: formJobId || null, reminder_minutes: formReminder,
      })
      error = result.error
    }

    if (error) {
      alert(`Failed to save: ${error.message}`)
    } else {
      console.log('Event saved successfully')
    }
    setFormLoading(false)
    if (!error) {
      resetForm()
      fetchEvents()
    }
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

  // ─── Derived ───
  const grid = useMemo(() => buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])

  const filtered = useMemo(() =>
    filter === 'all' ? events : events.filter(e => e.event_type === filter),
    [events, filter]
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      const key = format(new Date(e.start_time), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [filtered])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return (eventsByDate.get(key) || []).sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
  }, [selectedDate, eventsByDate])

  const activeFilters = useMemo(() => {
    const types = new Set(events.map(e => e.event_type))
    return ['all', ...Array.from(types)]
  }, [events])

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Calendar</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Track interviews, follow-ups, and deadlines
            </p>
          </div>
          <button onClick={() => { resetForm(); setFormDate(format(new Date(), 'yyyy-MM-dd')); setShowForm(true) }}
            className="text-[13px] font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-colors"
            style={{ background: 'var(--brand)' }}>
            + Add Event
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
          {activeFilters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-[12px] px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap"
              style={{
                background: filter === f ? 'var(--brand)' : 'var(--bg-surface)',
                color: filter === f ? 'white' : 'var(--text-tertiary)',
                border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              {f === 'all' ? 'All' : EVENT_COLORS[f] ? `${EVENT_COLORS[f].emoji} ${EVENT_COLORS[f].label}` : f}
            </button>
          ))}
        </div>

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── Calendar Grid ─── */}
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl border p-4 sm:p-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-2 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {format(viewDate, 'MMMM yyyy')}
                </h2>
                <button onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-2 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Weekday headers — fixed columns: Mon-Sun */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {WEEKDAY_LABELS.map(label => (
                  <div key={label} className="text-center text-[11px] font-semibold uppercase tracking-widest py-2"
                    style={{ color: 'var(--text-quaternary)' }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Day cells — 6 rows × 7 cols, fixed grid */}
              <div>
                {grid.map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                    {week.map((day, di) => {
                      const isCurrentMonth = day.getMonth() === viewDate.getMonth()
                      const isSelected = selectedDate && isSameDay(day, selectedDate)
                      const isTodayDate = isToday(day)
                      const dayKey = format(day, 'yyyy-MM-dd')
                      const dayEvents = eventsByDate.get(dayKey) || []

                      return (
                        <button
                          key={di}
                          onClick={() => {
                            if (!isCurrentMonth) {
                              // Navigate to that month and select
                              setViewDate(new Date(day.getFullYear(), day.getMonth(), 1))
                            }
                            setSelectedDate(isSelected ? null : day)
                          }}
                          className="relative flex flex-col items-center rounded-xl transition-colors"
                          style={{
                            aspectRatio: '1',
                            minHeight: '52px',
                            background: isSelected
                              ? 'rgba(94, 106, 210, 0.2)'
                              : isTodayDate
                                ? 'rgba(94, 106, 210, 0.08)'
                                : 'transparent',
                            border: isTodayDate && !isSelected
                              ? '1px solid rgba(94, 106, 210, 0.3)'
                              : '1px solid transparent',
                            opacity: isCurrentMonth ? 1 : 0.2,
                            cursor: 'pointer',
                          }}
                        >
                          {/* Day number — always centered in a fixed-size circle */}
                          <span
                            className="flex items-center justify-center rounded-full text-[13px] font-medium mt-1 flex-shrink-0"
                            style={{
                              width: '28px',
                              height: '28px',
                              background: isTodayDate ? 'var(--brand)' : 'transparent',
                              color: isTodayDate
                                ? 'white'
                                : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-quaternary)',
                            }}
                          >
                            {getDate(day)}
                          </span>

                          {/* Event dots */}
                      {dayEvents.length > 0 && isCurrentMonth && (
                            <div className="flex gap-1 flex-wrap justify-center mt-auto pb-1.5">
                              {[...new Set(dayEvents.map(e => e.event_type))].slice(0, 4).map((type, i) => (
                                <span
                                  key={type + i}
                                  className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                                  style={{ background: EVENT_COLORS[type]?.dot || EVENT_COLORS.other.dot }}
                                />
                              ))}
                              {dayEvents.length > 4 && (
                                <span className="text-[8px] leading-none" style={{ color: 'var(--text-quaternary)' }}>
                                  +{dayEvents.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right panel ─── */}
          <div className="w-full lg:w-80 flex-shrink-0">
            {selectedDate ? (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {format(selectedDate, 'EEEE')}
                    </h3>
                    <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <button onClick={() => setSelectedDate(null)}
                    className="text-[12px] p-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-quaternary)' }}>
                    ✕
                  </button>
                </div>

                {selectedDateEvents.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>No events</p>
                    <button onClick={() => { resetForm(); setFormDate(format(selectedDate, 'yyyy-MM-dd')); setShowForm(true) }}
                      className="mt-3 text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:opacity-80 transition-colors"
                      style={{ borderColor: 'var(--brand)', color: 'var(--brand-bright)' }}>
                      + Add event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map(event => {
                      const cfg = EVENT_COLORS[event.event_type] || EVENT_COLORS.other
                      return (
                        <div key={event.id} className="rounded-xl p-3.5"
                          style={{ background: cfg.bg, border: `1px solid ${cfg.dot}20` }}>
                          <div className="flex items-start gap-3">
                            <span className="text-[18px] flex-shrink-0 mt-0.5">{cfg.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{event.title}</h4>
                              <p className="text-[12px] mt-0.5" style={{ color: cfg.text }}>
                                🕐 {formatTime12(event.start_time)} – {formatTime12(event.end_time)}
                              </p>
                              {event.location && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>📍 {event.location}</p>}
                              {event.jobs && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>🏢 {event.jobs.company_name}</p>}
                              {event.notes && <p className="text-[12px] mt-1 line-clamp-2" style={{ color: 'var(--text-quaternary)' }}>{event.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-3 pt-2.5" style={{ borderTop: `1px solid ${cfg.dot}15` }}>
                            {!event.is_completed && (
                              <button onClick={() => handleComplete(event.id, true)}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                                style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓ Done</button>
                            )}
                            <button onClick={() => handleEdit(event)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>Edit</button>
                            <button onClick={() => handleDelete(event.id)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80 ml-auto"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Delete</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Upcoming</h3>
                {loading ? (
                  <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
                ) : (
                  <>
                    {filtered.filter(e => !e.is_completed && new Date(e.start_time) >= new Date()).length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-[24px] mb-2">📅</p>
                        <p className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>No upcoming events</p>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--text-quaternary)' }}>Click a date or add an event</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filtered
                          .filter(e => !e.is_completed && new Date(e.start_time) >= new Date())
                          .slice(0, 8)
                          .map(event => {
                            const cfg = EVENT_COLORS[event.event_type] || EVENT_COLORS.other
                            return (
                              <div key={event.id} className="rounded-lg p-3 cursor-pointer transition-colors hover:opacity-90"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                                onClick={() => setSelectedDate(new Date(event.start_time))}>
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[14px]">{cfg.emoji}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                                    <p className="text-[11px]" style={{ color: cfg.text }}>
                                      {format(new Date(event.start_time), 'EEE, MMM d')} · {formatTime12(event.start_time)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editEvent ? 'Edit Event' : 'New Event'}
                </h3>
                <button onClick={resetForm} className="p-1 rounded-lg hover:opacity-80" style={{ color: 'var(--text-quaternary)' }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="text" placeholder="Event title *" value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none focus:ring-2"
                  style={{ ...inputStyle, '--tw-ring-color': 'var(--brand)' } as React.CSSProperties} />
                <div className="grid grid-cols-2 gap-3">
                  <select value={formType} onChange={e => setFormType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle}>
                    {Object.entries(EVENT_COLORS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required
                    className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle} />
                  <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>→</span>
                  <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Location" value={formLocation} onChange={e => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle} />
                  <select value={formJobId} onChange={e => setFormJobId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none" style={inputStyle}>
                    <option value="">Link job...</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>)}
                  </select>
                </div>
                <textarea placeholder="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[14px] focus:outline-none resize-y" style={inputStyle} />
                <div className="flex items-center gap-3">
                  <label className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Reminder:</label>
                  <select value={formReminder} onChange={e => setFormReminder(Number(e.target.value))}
                    className="px-2.5 py-1 rounded-lg border text-[12px]" style={inputStyle}>
                    <option value={5}>5 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={1440}>1 day</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={resetForm}
                    className="text-[13px] font-medium px-4 py-2 rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)', background: 'var(--bg-surface)' }}>Cancel</button>
                  <button type="submit" disabled={formLoading}
                    className="text-[13px] font-medium px-6 py-2.5 rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                    style={{ background: 'var(--brand)' }}>
                    {formLoading ? 'Saving...' : editEvent ? 'Update' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
