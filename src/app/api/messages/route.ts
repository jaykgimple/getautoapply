import supabase from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact_id, content } = body
    if (!contact_id || !content) {
      return NextResponse.json({ error: 'Missing contact_id or content' }, { status: 400 })
    }
    const { data, error } = await supabase.from('outreach_messages').insert({
      contact_id,
      content,
      sent_at: new Date().toISOString(),
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
