'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string
  name: string
  email: string
  company: string
  status: string
  created_at: string
  outreach_messages?: OutreachMessage[]
}

interface OutreachMessage {
  id: string
  contact_id: string
  content: string
  sent_at: string
}

const CONTACT_STATUS = ['new', 'contacted', 'responded', 'connected', 'not_interested']

export default function OutreachPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [form, setForm] = useState({ name: '', email: '', company: '', status: 'new' })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedContact, setExpandedContact] = useState<string | null>(null)
  const [msgContent, setMsgContent] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const supabase = createClient()

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('contacts')
      .select('*, outreach_messages(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setContacts(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const resetForm = () => { setForm({ name: '', email: '', company: '', status: 'new' }); setEditContact(null); setShowForm(false); setError('') }

  const handleEdit = (contact: Contact) => {
    setForm({ name: contact.name, email: contact.email, company: contact.company, status: contact.status })
    setEditContact(contact)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (editContact) {
        const { error: err } = await supabase.from('contacts').update(form).eq('id', editContact.id).eq('user_id', user.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('contacts').insert({ ...form, user_id: user.id })
        if (err) throw err
      }
      resetForm()
      fetchContacts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('outreach_messages').delete().eq('contact_id', id).eq('user_id', user.id)
    await supabase.from('contacts').delete().eq('id', id).eq('user_id', user.id)
    fetchContacts()
  }

  const handleStatusChange = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('contacts').update({ status }).eq('id', id).eq('user_id', user.id)
    fetchContacts()
  }

  const handleSendMessage = async (contactId: string) => {
    if (!msgContent.trim()) return
    setMsgLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: err } = await supabase.from('outreach_messages').insert({
        user_id: user.id, contact_id: contactId, content: msgContent.trim(), sent_at: new Date().toISOString(),
      })
      if (err) throw err
      setMsgContent('')
      // Update contact status to contacted
      await supabase.from('contacts').update({ status: 'contacted' }).eq('id', contactId).eq('user_id', user.id)
      fetchContacts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setMsgLoading(false)
    }
  }

  const handleAiMessage = async (contact: Contact) => {
    setAiLoading(contact.id)
    setError('')
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [
            { role: 'system', content: 'You write short, professional, warm outreach messages to recruiters and contacts. Keep it under 150 words. Reference their company naturally. No generic templates.' },
            { role: 'user', content: `Write an outreach message to ${contact.name} at ${contact.company}. They are a recruiter/hiring manager. I'm a software engineer looking for new opportunities. Keep it short and genuine.` },
          ],
        }),
      })
      if (!response.ok) throw new Error('AI request failed')
      const data = await response.json()
      const generatedText = data.choices?.[0]?.message?.content || ''
      if (generatedText) {
        setMsgContent(generatedText)
        setExpandedContact(contact.id)
      }
    } catch (err: any) {
      setError(err.message || 'AI generation failed')
    } finally {
      setAiLoading(null)
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}><p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>Loading contacts...</p></div>
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Outreach</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{contacts.length} contacts · Recruiter outreach and follow-ups</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90 flex items-center gap-2" style={{ background: 'var(--brand)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Contact
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{editContact ? 'Edit Contact' : 'Add New Contact'}</h3>
              <button onClick={resetForm} className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>✕ Close</button>
            </div>
            {error && <p className="text-[13px] p-2 rounded-lg mb-3" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {CONTACT_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <button type="submit" disabled={formLoading} className="text-[13px] font-medium px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                {formLoading ? 'Saving...' : editContact ? 'Update Contact' : 'Add Contact'}
              </button>
            </form>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[14px]" style={{ color: 'var(--text-tertiary)' }}>No outreach contacts yet. Add recruiters and contacts to start automated outreach.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{contact.name || 'Unnamed'}</h3>
                      <span className="text-[11px] px-1.5 py-0.5 rounded capitalize" style={{
                        background: contact.status === 'responded' ? 'rgba(34,197,94,0.15)' : contact.status === 'connected' ? 'rgba(94,106,210,0.15)' : contact.status === 'not_interested' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                        color: contact.status === 'responded' ? 'var(--success)' : contact.status === 'connected' ? 'var(--brand-bright)' : contact.status === 'not_interested' ? 'var(--danger)' : 'var(--text-tertiary)',
                      }}>{contact.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                      {contact.email}{contact.company ? ` · ${contact.company}` : ''}
                      {contact.outreach_messages?.length ? ` · ${contact.outreach_messages.length} message${contact.outreach_messages.length !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleAiMessage(contact)} disabled={aiLoading === contact.id} className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50" style={{ borderColor: 'var(--brand)', color: 'var(--brand-bright)', background: 'transparent' }}>
                      {aiLoading === contact.id ? 'Generating...' : '✦ AI Message'}
                    </button>
                    <button onClick={() => handleDelete(contact.id)} className="text-[12px] font-medium opacity-0 group-hover:opacity-100" style={{ color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>

                {/* Expanded: messages + send */}
                {expandedContact === contact.id && (
                  <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    {/* Message history */}
                    {contact.outreach_messages && contact.outreach_messages.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {[...contact.outreach_messages].reverse().map((msg) => (
                          <div key={msg.id} className="rounded-lg p-3" style={{ background: 'var(--bg-surface)' }}>
                            <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{msg.content}</p>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-quaternary)' }}>{new Date(msg.sent_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Send message */}
                    <div className="space-y-2">
                      <textarea placeholder="Type a message..." value={msgContent} onChange={e => setMsgContent(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                      <div className="flex justify-end">
                        <button onClick={() => handleSendMessage(contact.id)} disabled={msgLoading || !msgContent.trim()} className="text-[12px] font-medium px-4 py-1.5 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                          {msgLoading ? 'Sending...' : 'Send Message'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
