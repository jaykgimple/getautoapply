import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body

    if (!url || !url.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'Please provide a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/yourname)' }, { status: 400 })
    }

    // Fetch the public LinkedIn profile page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json({
        error: `Could not fetch LinkedIn profile (${response.status}). Make sure your profile is set to public, or use Option 2 to paste manually.`,
      }, { status: 400 })
    }

    const html = await response.text()

    // Extract profile data from LinkedIn page's embedded JSON-LD or meta tags
    const profile: Record<string, string> = {}

    // Try to extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="\/ld\+json">([\s\S]*?)<\/script>/gi)
    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const jsonStr = script.replace(/<[^>]+>/g, '').trim()
          const data = JSON.parse(jsonStr)

          const profileData = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'Person') || data[0] : data

          if (profileData) {
            if (profileData.description) profile.about = profileData.description
            if (profileData.jobTitle) profile.headline = Array.isArray(profileData.jobTitle) ? profileData.jobTitle.join(', ') : profileData.jobTitle
            if (profileData.name && profileData.jobTitle) {
              const titles = Array.isArray(profileData.jobTitle) ? profileData.jobTitle : [profileData.jobTitle]
              profile.headline = `${titles[0]}`
            }
          }
          if (profileData.hasOccupation) {
            const occupations = Array.isArray(profileData.hasOccupation) ? profileData.hasOccupation : [profileData.hasOccupation]
            profile.experience = occupations
              .map((o: any) => `${o.name || o.jobTitle || ''}${o worksFor?.name ? ` at ${o.worksFor.name}` : ''}`)
              .filter(Boolean)
              .join('\n')
          }
          if (profileData.knowsAbout) {
            profile.skills = Array.isArray(profileData.knowsAbout) ? profileData.knowsAbout.join(', ') : profileData.knowsAbout
          }
        } catch {
          // Continue trying other scripts
        }
      }
    }

    // Fallback: extract from meta tags
    if (!profile.about) {
      const descMatch = html.match(/<meta\s+(?:name="description"|property="og:description")\s+content="([^"]*?)"/i)
      if (descMatch) profile.about = descMatch[1]
    }

    if (!profile.headline) {
      const titleMatch = html.match(/<title>([^<]*?)<\/title>/i)
      if (titleMatch) {
        // LinkedIn titles are like "John Doe - Title - LinkedIn"
        const titleParts = titleMatch[1].split(' - ')
        if (titleParts.length >= 2) {
          profile.headline = titleParts.slice(1, -1).join(' - ')
        }
      }
    }

    // Also try to extract skills from page content via common patterns
    if (!profile.skills) {
      // Look for skills section patterns
      const skillsSection = html.match(/Skills[\s\S]{0,500}?>([^<]{3,200})</i)
      if (skillsSection) {
        profile.skills = skillsSection[1].trim()
      }
    }

    // If we still have very little data, the profile might be gated
    const hasData = Object.values(profile).some(v => v.trim().length > 10)

    if (!hasData) {
      return NextResponse.json({
        error: 'Could not extract profile data. LinkedIn may require login to view this profile. Please set your profile to public, or use Option 2 to paste your info manually.',
      }, { status: 422 })
    }

    return NextResponse.json({ profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch profile' }, { status: 500 })
  }
}
