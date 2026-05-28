import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from('resumes').select('*').order('is_master', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resumes: data })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // If tailor_for_job_id is provided, generate AI-tailored resume
  if (body.tailor_for_job_id) {
    const { tailorResume } = await import('@/lib/ai/resume')
    const { data: job } = await supabase.from('jobs').select('*').eq('id', body.tailor_for_job_id).single()
    const { data: master } = await supabase.from('resumes').select('*').eq('is_master', true).eq('user_id', user.id).single()

    if (job && master) {
      const tailored = await tailorResume(master.content, job.description || '', job.title, job.company)

      const { data, error } = await supabase.from('resumes').insert({
        user_id: user.id,
        name: `${job.title} @ ${job.company}`,
        is_master: false,
        content: tailored.resume,
        ats_score: tailored.atsScore,
        target_job_id: job.id,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ resume: data, ats_score: tailored.atsScore }, { status: 201 })
    }
  }

  // Regular resume create
  const { data, error } = await supabase.from('resumes').insert({
    user_id: user.id,
    name: body.name || 'Untitled Resume',
    is_master: body.is_master || false,
    content: body.content || {},
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resume: data }, { status: 201 })
}
