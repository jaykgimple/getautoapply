import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// LinkedIn OAuth 2.0 config
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI!

const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'public' } })

async function getLinkedInAccessToken(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
    redirect_uri: LINKEDIN_REDIRECT_URI,
  })

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn token exchange failed: ${res.status} ${err}`)
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

async function fetchLinkedInProfile(accessToken: string) {
  // Use the OpenID Connect userinfo endpoint (works with openid + profile + email scopes)
  const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!userinfoRes.ok) {
    // Fallback to lite profile
    const liteRes = await fetch(
      'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline,vanityName,profilePicture(displayImage~:playableStreams))',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!liteRes.ok) throw new Error(`LinkedIn profile fetch failed: ${liteRes.status}`)
    const p = await liteRes.json()
    return parseLiteProfile(p)
  }

  const info = await userinfoRes.json()

  // Profile image extraction
  let imageUrl = ''
  try {
    const picData = info.picture || ''
    imageUrl = typeof picData === 'string' ? picData : ''
  } catch { /* optional */ }

  return {
    id: info.sub || info.id || '',
    firstName: info.given_name || '',
    lastName: info.family_name || '',
    headline: info.sub || '',  // userinfo doesn't include headline; would need separate call
    summary: '',
    profileUrl: `https://www.linkedin.com/in/${info.sub || ''}`,
    imageUrl,
    email: info.email || '',
    experience: [],
    skills: [],
  }
}

function parseLiteProfile(profile: any) {
  let imageUrl = ''
  try {
    const imgData = profile.profilePicture?.['displayImage~']?.elements
    if (imgData?.length) {
      const sorted = [...imgData].sort((a: any, b: any) => {
        const aSize = (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || 0)
        const bSize = (b.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || 0)
        return bSize - aSize
      })
      imageUrl = sorted[0]?.identifiers?.[0]?.identifier || ''
    }
  } catch { /* optional */ }

  return {
    id: profile.id,
    firstName: profile.localizedFirstName || '',
    lastName: profile.localizedLastName || '',
    headline: profile.localizedHeadline || '',
    summary: '',
    profileUrl: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`,
    imageUrl,
    email: '',
    experience: [],
    skills: [],
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://getautoapply.vercel.app'}/settings?linkedin_error=${error}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://getautoapply.vercel.app'}/settings?linkedin_error=missing_params`)
    }

    const userId = state

    const tokenData = await getLinkedInAccessToken(code)
    const accessToken = tokenData.access_token

    const linkedinProfile = await fetchLinkedInProfile(accessToken)

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      linkedin_connected: true,
      linkedin_id: linkedinProfile.id,
      linkedin_first_name: linkedinProfile.firstName,
      linkedin_last_name: linkedinProfile.lastName,
      linkedin_headline: linkedinProfile.headline,
      linkedin_summary: linkedinProfile.summary,
      linkedin_profile_url: linkedinProfile.profileUrl,
      linkedin_profile_image_url: linkedinProfile.imageUrl,
      linkedin_raw_profile: linkedinProfile,
      linkedin_token: accessToken,
      linkedin_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (upsertError) {
      console.error('LinkedIn upsert error:', upsertError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://getautoapply.vercel.app'}/settings?linkedin_error=${encodeURIComponent(upsertError.message)}`)
    }

    console.log('LinkedIn connected for user:', userId)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://getautoapply.vercel.app'}/settings?linkedin_connected=true`)
  } catch (err: any) {
    console.error('LinkedIn OAuth error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://getautoapply.vercel.app'}/settings?linkedin_error=${encodeURIComponent(err.message || 'unknown')}`)
  }
}

// POST: Generate the LinkedIn OAuth authorization URL
export async function POST() {
  try {
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) {
      return NextResponse.json({
        error: 'LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI env vars.',
      }, { status: 500 })
    }

    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const supabaseAnon = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string) => { try { cookieStore.set({ name, value }) } catch {} },
        remove: (name: string) => { try { cookieStore.set({ name, value: '' }) } catch {} },
      },
    })
    const { data: { user } } = await supabaseAnon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Use OpenID Connect scopes (recommended by LinkedIn for new apps)
    const scopes = encodeURIComponent('openid profile email')
    const state = user.id
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&scope=${scopes}&state=${state}`

    return NextResponse.json({ authUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
