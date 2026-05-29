import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Email notification preferences & job alerts
 * 
 * GET  /api/notifications/preferences — get user preferences
 * POST /api/notifications/preferences — update preferences
 * POST /api/notifications/alert — create a new job alert
 * GET  /api/notifications/alerts — list user's alerts
 * DELETE /api/notifications/alerts/:id — delete an alert
 */

// Shared admin client for service-role operations
function adminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Get current user from request
async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: any) { try { cookieStore.set(name, value, options) } catch {} },
      remove(name: string, options: any) { try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch {} },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── GET: Fetch preferences ───
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = adminClient()
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    return NextResponse.json(data || getDefaultPreferences(user.id))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── POST: Update preferences or create alert ───
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type } = body

    if (type === 'alert') {
      return createAlert(user.id, body)
    }

    return updatePreferences(user.id, body)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function updatePreferences(userId: string, prefs: any) {
  const supabaseAdmin = adminClient()

  const data = {
    user_id: userId,
    job_alerts: prefs.job_alerts ?? true,
    application_updates: prefs.application_updates ?? true,
    interview_reminders: prefs.interview_reminders ?? true,
    weekly_digest: prefs.weekly_digest ?? true,
    email_frequency: prefs.email_frequency || 'daily',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert(data, { onConflict: 'user_id' })

  if (error) throw error
  return NextResponse.json({ success: true, data })
}

async function createAlert(userId: string, body: any) {
  const supabaseAdmin = adminClient()

  const { query, location, frequency, sources } = body
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const data = {
    user_id: userId,
    query: query.trim(),
    location: location?.trim() || null,
    frequency: frequency || 'daily',
    sources: sources || ['indeed', 'linkedin'],
    is_active: true,
    last_sent_at: null,
    created_at: new Date().toISOString(),
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('job_alerts')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return NextResponse.json({ success: true, alert: inserted })
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
