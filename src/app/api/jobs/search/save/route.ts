import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    // Use base columns (company_name and url are generated)
    const job = {
      user_id: user.id,
      title: body.title || 'Untitled',
      company: body.company_name || '',
      location: body.location || null,
      salary_min: body.salary_min ? Number(body.salary_min) : null,
      salary_max: body.salary_max ? Number(body.salary_max) : null,
      description: body.description || null,
      job_url: body.url || null,
      source: body.source || 'search',
      job_type: body.job_type || null,
      remote_type: body.is_remote ? 'remote' : 'onsite',
      status: 'saved',
    }

    // Check if already saved
    if (job.job_url) {
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_url', job.job_url)
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
