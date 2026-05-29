import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: any) { try { cookieStore.set(name, value, options) } catch {} },
      remove(name: string, options: any) { try { cookieSet.set(name, '', { ...options, maxAge: 0 }) } catch {} },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Calendar Events API
 * 
 * GET  /api/calendar/events — list user events
 * POST /api/calendar/events — create event
 * PUT  /api/calendar/events/:id — update event
 * DELETE /api/calendar/events/:id — delete event
 * POST /api/calendar/events/:id/export — generate .ics file
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString()
    const to = searchParams.get('to') || new Date(Date.now() + 90 * 86400000).toISOString()

    const supabaseAdmin = adminClient()
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*, jobs(title, company_name), applications(status)')
      .eq('user_id', user.id)
      .gte('start_time', from)
      .lte('end_time', to)
      .order('start_time', { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      title,
      description,
      eventType, // 'interview', 'follow_up', 'deadline', 'networking', 'other'
      startTime,
      endTime,
      location,
      jobId,
      applicationId,
      reminderMinutes,
      notes,
      attendees,
    } = body

    if (!title || !startTime) {
      return NextResponse.json({ error: 'Title and startTime required' }, { status: 400 })
    }

    const supabaseAdmin = adminClient()
    const event = {
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      event_type: eventType || 'interview',
      start_time: startTime,
      end_time: endTime || new Date(new Date(startTime).getTime() + 3600000).toISOString(),
      location: location?.trim() || null,
      job_id: jobId || null,
      application_id: applicationId || null,
      reminder_minutes: reminderMinutes || 15,
      notes: notes?.trim() || null,
      attendees: attendees || [],
      is_completed: false,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert(event)
      .select('*, jobs(title, company_name)')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, event: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Event ID required' }, { status: 400 })

    const body = await req.body.json?.() || {}
    const supabaseAdmin = adminClient()

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, jobs(title, company_name)')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, event: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── Generate .ics file for an event ───
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (action === 'complete') {
      const supabaseAdmin = adminClient()
      await supabaseAdmin
        .from('calendar_events')
        .update({ is_completed: true })
        .eq('id', id)
        .eq('user_id', user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'export' && id) {
      const supabaseAdmin = adminClient()
      const { data: event } = await supabaseAdmin
        .from('calendar_events')
        .select('*, jobs(title, company_name)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

      const ics = generateICS(event)
      return new NextResponse(ics, {
        headers: {
          'Content-Type': 'text/calendar',
          'Content-Disposition': `attachment; filename="event-${id}.ics"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Event ID required' }, { status: 400 })

    const supabaseAdmin = adminClient()
    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── ICS Generator ───
function generateICS(event: any): string {
  const formatDate = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const now = formatDate(new Date().toISOString())
  const start = formatDate(event.start_time)
  const end = formatDate(event.end_time)
  const summary = event.title.replace(/[,;\\]/g, '\\$&')
  const description = (event.description || '').replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GetAutoApply//Calendar//EN',
    'BEGIN:VEVENT',
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    `UID:${event.id}@getautoapply.com`,
    `URL:https://getautoapply.vercel.app/calendar`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}
