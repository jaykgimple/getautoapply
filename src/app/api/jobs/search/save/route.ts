import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/jobs/search/save
 * Save a job from external search results into the user's jobs table
 * Body: { external_id, title, company_name, location, salary_min, salary_max, description, url, source, source_detail, job_type, is_remote }
 */
export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json()

    const job = {
      user_id: user.id,
      title: body.title || 'Untitled',
      company_name: body.company_name || '',
      location: body.location || null,
      salary_min: body.salary_min ? Number(body.salary_min) : null,
      salary_max: body.salary_max ? Number(body.salary_max) : null,
      description: body.description || null,
      url: body.url || null,
      source: body.source || 'search',
      source_detail: body.source_detail || null,
      job_type: body.job_type || null,
      is_remote: body.is_remote || false,
      status: 'saved',
      created_at: new Date().toISOString(),
    }

    // Check if already saved (by url or external_id)
    if (job.url) {
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', job.url)
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'Job already saved', id: existing[0].id }, { status: 409 })
      }
    }

    const { data, error } = await supabase.from('jobs').insert(job).select().single()
    if (error) throw error

    return NextResponse.json({ success: true, job: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
