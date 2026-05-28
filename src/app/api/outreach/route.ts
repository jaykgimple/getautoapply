import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const [contacts, messages] = await Promise.all([
    supabase.from('contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('outreach_messages').select('*, contacts(name)').order('sent_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ contacts: contacts.data, messages: messages.data })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.type === 'contact') {
    const { data, error } = await supabase.from('contacts').insert({
      user_id: user.id, name: body.name, company: body.company || null,
      title: body.title || null, email: body.email || null,
      linkedin_url: body.linkedin_url || null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data }, { status: 201 })
  }

  if (body.type === 'message') {
    const { data, error } = await supabase.from('outreach_messages').insert({
      user_id: user.id, contact_id: body.contact_id,
      channel: body.channel || 'email', direction: 'sent',
      subject: body.subject || null, body: body.body,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: data }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
