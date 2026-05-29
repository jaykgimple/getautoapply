import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string) => { try { cookieStore.set({ name, value }) } catch {} },
        remove: (name: string) => { try { cookieStore.set({ name, value: '' }) } catch {} },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('linkedin_connected, linkedin_raw_profile, linkedin_token, linkedin_connected_at')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ connected: false, profile: null })
    }

    if (!profile.linkedin_connected) {
      return NextResponse.json({ connected: false, profile: null })
    }

    // Check if token is older than 60 days
    if (profile.linkedin_connected_at) {
      const connectedAt = new Date(profile.linkedin_connected_at)
      const daysSince = (Date.now() - connectedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince > 60) {
        return NextResponse.json({ connected: false, profile: null, expired: true })
      }
    }

    return NextResponse.json({
      connected: true,
      profile: profile.linkedin_raw_profile || null,
    })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 })
  }
}
