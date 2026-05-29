import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) { try { cookieStore.set(name, value, options) } catch {} },
      remove(name: string, options: CookieOptions) { try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch {} },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString()
    const to = searchParams.get('to') || new Date(Date.now() + 90 * 86400000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*, jobs(title, company_name)')
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
    const { title, description, eventType, startTime, endTime, location, jobId, applicationId, reminderMinutes, notes, attendees } = body

    if (!title || !startTime) {
      return NextResponse.json({ error: 'Title and startTime required' }, { status: 400 })
    }

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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (!id) return NextResponse.json({ error: 'Event ID required' }, { status: 400 })

    if (action === 'complete') {
      await supabaseAdmin.from('calendar_events').update({ is_completed: true }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'export') {
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

    const { error } = await supabaseAdmin.from('calendar_events').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function generateICS(event: any): string {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const now = fmt(new Date().toISOString())
  const start = fmt(event.start_time)
  const end = fmt(event.end_time)
  const esc = (s: string) => s?.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n') || ''

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GetAutoApply//Calendar//EN',
    'BEGIN:VEVENT',
    `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${esc(event.title)}`,
    event.description ? `DESCRIPTION:${esc(event.description)}` : '',
    event.location ? `LOCATION:${esc(event.location)}` : '',
    `UID:${event.id}@getautoapply.com`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}
