import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import supabaseAdmin from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET: fetch the user's stored LinkedIn profile data
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('linkedin_connected, linkedin_headline, linkedin_summary, linkedin_raw_profile, linkedin_profile_url, linkedin_profile_image_url, linkedin_first_name, linkedin_last_name')
      .eq('id', user.id)
      .single()

    if (error || !profile?.linkedin_connected) {
      return NextResponse.json({ connected: false, error: 'LinkedIn not connected' }, { status: 404 })
    }

    const raw = profile.linkedin_raw_profile || {}

    return NextResponse.json({
      connected: true,
      profile: {
        name: `${profile.linkedin_first_name || ''} ${profile.linkedin_last_name || ''}`.trim(),
        headline: profile.linkedin_headline || '',
        summary: profile.linkedin_summary || '',
        profileUrl: profile.linkedin_profile_url || '',
        imageUrl: profile.linkedin_profile_image_url || '',
        experience: raw.experience || [],
        skills: raw.skills || [],
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: re-fetch fresh profile from LinkedIn API (if token is still valid)
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get the stored token
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('linkedin_token, linkedin_raw_profile')
      .eq('id', user.id)
      .single()

    if (!profile?.linkedin_token) {
      return NextResponse.json({ error: 'No LinkedIn token. Please reconnect.' }, { status: 401 })
    }

    // Try to fetch fresh data — if token expired, this will fail
    const profileRes = await fetch(
      'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline)',
      { headers: { Authorization: `Bearer ${profile.linkedin_token}` } }
    )

    if (!profileRes.ok) {
      // Token expired — mark as disconnected
      await supabaseAdmin.from('profiles').update({
        linkedin_connected: false,
        linkedin_token: null,
      }).eq('id', user.id)
      return NextResponse.json({ error: 'LinkedIn token expired. Please reconnect.', expired: true }, { status: 401 })
    }

    const fresh = await profileRes.json()

    // Update stored data
    await supabaseAdmin.from('profiles').update({
      linkedin_first_name: fresh.localizedFirstName || '',
      linkedin_last_name: fresh.localizedLastName || '',
      linkedin_headline: fresh.localizedHeadline || '',
      linkedin_raw_profile: { ...profile.linkedin_raw_profile, refreshed: fresh },
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    return NextResponse.json({ connected: true, message: 'Profile refreshed' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
