import supabase from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, outreach_messages(*)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contacts: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, ...contactData } = body
    const { data: contact, error } = await supabase.from('contacts').insert({
      name: contactData.name || '',
      email: contactData.email || '',
      company: contactData.company || '',
      status: contactData.status || 'new',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const msgRows = messages.map((m: any) => ({
        contact_id: contact.id,
        content: m.content,
        sent_at: m.sent_at || new Date().toISOString(),
      }))
      await supabase.from('outreach_messages').insert(msgRows)
    }
    return NextResponse.json({ contact }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await supabase.from('outreach_messages').delete().eq('contact_id', id)
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
