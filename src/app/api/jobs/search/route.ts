import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()
    const location = (searchParams.get('location') || '').trim()
    const remote = searchParams.get('remote') === 'true'
    const jobType = searchParams.get('job_type') || ''
    const source = searchParams.get('source') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, parseInt(searchParams.get('limit') || '25'))

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

    // Build query — public jobs, no auth required to browse
    let dbQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true)

    // Text search
    if (query) {
      const searchTerm = `%${query}%`
      dbQuery = dbQuery.or(
        `title.ilike.${searchTerm},company.ilike.${searchTerm},description.ilike.${searchTerm},skills_required.ilike.${searchTerm}`
      )
    }

    // Location filter
    if (location) {
      const loc = location.toLowerCase()
      if (loc === 'remote') {
        dbQuery = dbQuery.eq('remote_type', 'remote')
      } else {
        dbQuery = dbQuery.or(`location.ilike.%${location}%,remote_type.eq.remote`)
      }
    }

    // Remote filter
    if (remote) {
      dbQuery = dbQuery.eq('remote_type', 'remote')
    }

    // Job type filter
    if (jobType) {
      dbQuery = dbQuery.eq('job_type', jobType)
    }

    // Source filter — supports exact match and prefix groups (e.g. "greenhouse" matches "greenhouse_airbnb")
    if (source) {
      if (source === 'greenhouse') {
        dbQuery = dbQuery.ilike('source', 'greenhouse%')
      } else if (source === 'remotive') {
        dbQuery = dbQuery.ilike('source', 'remotive%')
      } else if (source === 'jobspy') {
        dbQuery = dbQuery.in('source', ['jobspy_linkedin', 'jobspy_indeed'])
      } else {
        dbQuery = dbQuery.eq('source', source)
      }
    }

    // Order and paginate
    dbQuery = dbQuery
      .order('posted_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    dbQuery = dbQuery.range(from, to)

    const { data: jobs, error, count } = await dbQuery

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json({ error: 'Search failed', details: error.message }, { status: 500 })
    }

    // Format results
    const results = (jobs || []).map((job: any) => ({
      id: job.id,
      external_id: job.id,
      title: job.title,
      company_name: job.company,
      location: job.location || 'Remote',
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      description: (job.description || job.raw_description || '').substring(0, 2000),
      url: job.job_url,
      source: job.source || 'database',
      posted_at: job.posted_date || job.created_at,
      job_type: job.job_type,
      is_remote: job.remote_type === 'remote',
      skills: job.skills_required,
      match_score: 50, // Default score without user profile
    }))

    return NextResponse.json({
      jobs: results,
      total: count || results.length,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    })
  } catch (err: any) {
    console.error('Search error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
