import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com'
const SERPAPI_BASE = 'https://serpapi.com/search'

// ─── JSearch (RapidAPI) — Primary source ───
// Covers: LinkedIn, Indeed, Glassdoor, ZipRecruiter, BeBee
// Free tier: 200 requests/month
async function searchJSearch(query: string, location: string, page: number = 1) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return { source: 'jsearch', jobs: [], error: 'RAPIDAPI_KEY not configured' }

  const params = new URLSearchParams({
    query: location ? `${query} in ${location}` : query,
    page: String(page),
    num_pages: '1',
  })

  const res = await fetch(`https://${RAPIDAPI_HOST}/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { source: 'jsearch', jobs: [], error: `JSearch ${res.status}: ${err}` }
  }

  const data = await res.json()
  const jobs = (data.data || []).map((j: any) => ({
    external_id: j.job_id || j.employer_name + j.job_title,
    title: j.job_title || '',
    company_name: j.employer_name || '',
    location: j.job_is_remote ? 'Remote' : [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
    salary_min: j.job_min_salary ? Math.round(j.job_min_salary) : null,
    salary_max: j.job_max_salary ? Math.round(j.job_max_salary) : null,
    description: (j.job_description || '').substring(0, 2000),
    url: j.job_apply_link || j.job_google_link || null,
    source: 'jsearch',
    source_detail: j.employer_name || 'JSearch',
    posted_at: j.job_posted_at_datetime_utc || null,
    job_type: j.job_employment_type || null,
    is_remote: j.job_is_remote || false,
  }))

  return { source: 'jsearch', jobs, total: data.total_count || jobs.length }
}

// ─── Indeed RSS — Free fallback, no API key ───
async function searchIndeedRSS(query: string, location: string) {
  const params = new URLSearchParams({
    q: query,
    l: location || '',
    sort: 'date',
    limit: '25',
  })

  const res = await fetch(`https://rss.indeed.com/rss?${params}`, {
    headers: { 'User-Agent': 'GetAutoApply/1.0' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return { source: 'indeed', jobs: [], error: `Indeed ${res.status}` }

  const xml = await res.text()
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []

  const jobs = items.map((item) => {
    const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') || ''
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
    const desc = item.match(/<description>(.*?)<\/description>/)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000) || ''
    // Indeed RSS title format: "Job Title - Company Name"
    const titleParts = title.split(' - ')
    const jobTitle = titleParts[0]?.trim() || title
    const company = titleParts[1]?.trim() || ''
    // Extract location from description or use empty
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || null

    return {
      external_id: link,
      title: jobTitle,
      company_name: company,
      location: location || '',
      salary_min: null,
      salary_max: null,
      description: desc,
      url: link,
      source: 'indeed',
      source_detail: 'Indeed RSS',
      posted_at: pubDate ? new Date(pubDate).toISOString() : null,
      job_type: null,
      is_remote: /remote/i.test(title + ' ' + desc),
    }
  }).filter(j => j.title && j.url)

  return { source: 'indeed', jobs, total: jobs.length }
}

// ─── Google Jobs via SerpApi ───
async function searchGoogleJobs(query: string, location: string) {
  const key = process.env.SERPAPI_KEY
  if (!key) return { source: 'google', jobs: [], error: 'SERPAPI_KEY not configured' }

  const params = new URLSearchParams({
    engine: 'google_jobs',
    q: location ? `${query} in ${location}` : query,
    api_key: key,
  })

  const res = await fetch(`${SERPAPI_BASE}?${params}`, {
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) return { source: 'google', jobs: [], error: `SerpApi ${res.status}` }

  const data = await res.json()
  const jobs = (data.jobs_results || []).map((j: any) => ({
    external_id: j.job_id || '',
    title: j.title || '',
    company_name: j.company_name || '',
    location: j.location || '',
    salary_min: null,
    salary_max: null,
    description: (j.description || '').substring(0, 2000),
    url: j.apply_options?.[0]?.link || null,
    source: 'google',
    source_detail: j.via || 'Google Jobs',
    posted_at: j.detected_extensions?.posted_at
      ? new Date(j.detected_extensions.posted_at).toISOString()
      : null,
    job_type: j.detected_extensions?.schedule_type || null,
    is_remote: /remote/i.test(j.title + ' ' + j.location + ' ' + (j.description || '')),
  }))

  return { source: 'google', jobs, total: jobs.length }
}

// ─── Deduplicate by title+company ───
function deduplicate(jobs: any[]) {
  const seen = new Set<string>()
  return jobs.filter(j => {
    const key = `${j.title.toLowerCase().trim()}|${j.company_name.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Main API Route ───
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const location = searchParams.get('location') || ''
    const sources = (searchParams.get('sources') || 'jsearch,indeed,google').split(',')
    const page = parseInt(searchParams.get('page') || '1')

    if (!query.trim() && !location.trim()) {
      return NextResponse.json({ error: 'Provide a query (q) or location' }, { status: 400 })
    }

    // Verify auth
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Run all source queries in parallel
    const promises: Promise<any>[] = []

    if (sources.includes('jsearch')) promises.push(searchJSearch(query, location, page))
    if (sources.includes('indeed')) promises.push(searchIndeedRSS(query, location))
    if (sources.includes('google')) promises.push(searchGoogleJobs(query, location))

    const results = await Promise.allSettled(promises)

    let allJobs: any[] = []
    const errors: Record<string, string> = {}

    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        allJobs = allJobs.concat(r.value.jobs || [])
        if (r.value.error) errors[r.value.source] = r.value.error
      } else {
        errors['unknown'] = r.reason?.message
      }
    })

    // Deduplicate
    const unique = deduplicate(allJobs)

    // Score match against user profile (basic keyword matching)
    const { data: profile } = await supabase
      .from('profiles')
      .select('headline, location, resume_json')
      .eq('id', user.id)
      .single()

    const userSkills = extractSkills(profile?.resume_json)
    const userHeadline = (profile?.headline || '').toLowerCase()
    const userLocation = (profile?.location || '').toLowerCase()

    const scored = unique.map((job: any) => ({
      ...job,
      match_score: computeMatchScore(job, userSkills, userHeadline, userLocation),
    }))

    // Sort by match score desc, then posted date desc
    scored.sort((a: any, b: any) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score
      return new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime()
    })

    return NextResponse.json({
      jobs: scored,
      total: scored.length,
      sources_used: sources.filter(s => !errors[s]),
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── Helper: Extract skills from resume_json ───
function extractSkills(resumeJson: any): string[] {
  if (!resumeJson) return []
  const skills: string[] = []
  try {
    const r = typeof resumeJson === 'string' ? JSON.parse(resumeJson) : resumeJson
    if (Array.isArray(r.skills)) skills.push(...r.skills.map((s: any) => (typeof s === 'string' ? s : s.name || '').toLowerCase()))
    if (Array.isArray(r.experience)) {
      r.experience.forEach((e: any) => {
        if (e.title) skills.push(e.title.toLowerCase())
        if (e.description) {
          const words = e.description.toLowerCase().split(/\W+/)
          const techWords = words.filter((w: string) => w.length > 3 && COMMON_SKILLS.has(w))
          skills.push(...techWords)
        }
      })
    }
  } catch { /* invalid JSON */ }
  return [...new Set(skills)].filter(Boolean)
}

// ─── Helper: Compute match score 0-100 ───
function computeMatchScore(job: any, userSkills: string[], userHeadline: string, userLocation: string): number {
  let score = 50 // base
  const jobText = `${job.title} ${job.description || ''}`.toLowerCase()
  const jobLocation = (job.location || '').toLowerCase()

  // Skills match
  if (userSkills.length > 0) {
    const matched = userSkills.filter(s => jobText.includes(s)).length
    score += Math.min(30, (matched / Math.min(userSkills.length, 10)) * 30)
  }

  // Headline keyword overlap
  if (userHeadline) {
    const headlineWords = userHeadline.split(/\W+/).filter(w => w.length > 3)
    const matched = headlineWords.filter(w => jobText.includes(w)).length
    score += Math.min(10, (matched / Math.max(headlineWords.length, 1)) * 10)
  }

  // Location match
  if (userLocation && jobLocation) {
    if (jobLocation.includes(userLocation) || userLocation.includes(jobLocation) || job.is_remote) {
      score += 10
    }
  }

  return Math.round(Math.min(100, Math.max(0, score)))
}

// Common tech skills for extraction
const COMMON_SKILLS = new Set([
  'javascript', 'typescript', 'python', 'java', 'react', 'node', 'nodejs', 'node.js',
  'angular', 'vue', 'svelte', 'nextjs', 'next.js', 'express', 'django', 'flask',
  'spring', 'rails', 'laravel', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd',
  'git', 'agile', 'scrum', 'jira', 'figma', 'sketch',
  'html', 'css', 'sass', 'tailwind', 'bootstrap',
  'graphql', 'rest', 'api', 'microservices', 'serverless',
  'redis', 'elasticsearch', 'kafka', 'rabbitmq',
  'linux', 'unix', 'bash', 'shell',
  'machine', 'learning', 'ai', 'ml', 'nlp', 'data', 'analytics',
  'salesforce', 'hubspot', 'marketo',
  'recruiting', 'hiring', 'sourcing', 'talent',
  'project', 'management', 'product', 'strategy',
  'communication', 'leadership', 'collaboration',
])
