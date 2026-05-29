import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// LinkedIn OAuth 2.0 config
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI!

const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'public' } })

// Step 1: Exchange auth code for access token
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

// Step 2: Fetch profile data using access token
async function fetchLinkedInProfile(accessToken: string) {
  // Core profile: id, firstName, lastName, headline, profilePicture
  const profileRes = await fetch(
    'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadVanityName,profilePicture(displayImage~:playableStreams))',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!profileRes.ok) throw new Error(`LinkedIn profile fetch failed: ${profileRes.status}`)
  const profile = await profileRes.json()

  // About/summary via liteProfile+ or positions API
  // Experience
  let experience: string[] = []
  try {
    const expRes = await fetch(
      'https://api.linkedin.com/v2/positions?start=0&count=10',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (expRes.ok) {
      const expData = await expRes.json()
      if (expData.elements) {
        experience = expData.elements.map((e: any) => {
          const title = e.title || ''
          const company = e.companyName || e.company?.name || ''
          const desc = e.description || ''
          return `${title}${company ? ` at ${company}` : ''}${desc ? `\n${desc}` : ''}`
        })
      }
    }
  } catch { /* experience is optional */ }

  // Skills
  let skills: string[] = []
  try {
    const skillsRes = await fetch(
      'https://api.linkedin.com/v2/skills?start=0&count=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (skillsRes.ok) {
      const skillsData = await skillsRes.json()
      if (skillsData.elements) {
        skills = skillsData.elements.map((s: any) => s.name?.localized?.en_US || s.name || '').filter(Boolean)
      }
    }
  } catch { /* skills is optional */ }

  // Vanity name / public URL
  const vanityName = profile.localizedVanityName || profile.id
  const profileUrl = `https://www.linkedin.com/in/${vanityName}`

  // Profile image
  let imageUrl = ''
  try {
    const imgData = profile.profilePicture?.['displayImage~']?.elements
    if (imgData?.length) {
      // Get the largest resolution
      const sorted = [...imgData].sort((a: any, b: any) => {
        const aSize = (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || 0)
        const bSize = (b.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || 0)
        return bSize - aSize
      })
      imageUrl = sorted[0]?.identifiers?.[0]?.identifier || ''
    }
  } catch { /* image is optional */ }

  return {
    id: profile.id,
    firstName: profile.localizedFirstName || '',
    lastName: profile.localizedLastName || '',
    headline: profile.localizedHeadline || '',
    summary: profile.localizedSummary || '',
    profileUrl,
    imageUrl,
    experience,
    skills,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // contains user_id
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ''}/linkedin?linkedin_error=${error}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ''}/linkedin?linkedin_error=missing_params`)
    }

    const userId = state

    // Exchange code for token
    const tokenData = await getLinkedInAccessToken(code)
    const accessToken = tokenData.access_token

    // Fetch profile
    const profile = await fetchLinkedInProfile(accessToken)

    // Save to Supabase profiles table
    await supabase.from('profiles').upsert({
      id: userId,
      linkedin_connected: true,
      linkedin_id: profile.id,
      linkedin_first_name: profile.firstName,
      linkedin_last_name: profile.lastName,
      linkedin_headline: profile.headline,
      linkedin_summary: profile.summary,
      linkedin_profile_url: profile.profileUrl,
      linkedin_profile_image_url: profile.imageUrl,
      linkedin_raw_profile: profile,
      linkedin_token: accessToken,
      linkedin_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Redirect back to LinkedIn Analyzer with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ''}/linkedin?linkedin_connected=true`)
  } catch (err: any) {
    console.error('LinkedIn OAuth error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ''}/linkedin?linkedin_error=${encodeURIComponent(err.message || 'unknown')}`)
  }
}

// Generate the LinkedIn OAuth authorization URL
export async function POST() {
  try {
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) {
      return NextResponse.json({
        error: 'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI env vars.',
      }, { status: 500 })
    }

    const { createClient: createBrowserClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const supabaseBrowser = createBrowserClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    })
    const { data: { user } } = await supabaseBrowser.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const scopes = encodeURIComponent('r_liteprofile r_emailaddress')
    const state = user.id
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&scope=${scopes}&state=${state}`

    return NextResponse.json({ authUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
