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

function getDefaultPreferences(userId: string) {
  return {
    user_id: userId,
    job_alerts: true,
    application_updates: true,
    interview_reminders: true,
    weekly_digest: true,
    email_frequency: 'daily',
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return NextResponse.json(data || getDefaultPreferences(user.id))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type } = body

    if (type === 'alert') {
      const { query, location, frequency, sources } = body
      if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('job_alerts')
        .insert({
          user_id: user.id,
          query: query.trim(),
          location: location?.trim() || null,
          frequency: frequency || 'daily',
          sources: sources || ['indeed'],
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, alert: data })
    }

    // Update preferences
    const data = {
      user_id: user.id,
      job_alerts: body.job_alerts ?? true,
      application_updates: body.application_updates ?? true,
      interview_reminders: body.interview_reminders ?? true,
      weekly_digest: body.weekly_digest ?? true,
      email_frequency: body.email_frequency || 'daily',
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert(data, { onConflict: 'user_id' })

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
