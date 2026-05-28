import { createClient } from '@/lib/supabase/server'

export default async function OutreachPage() {
  const supabase = createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const { data: messages } = await supabase
    .from('outreach_messages')
    .select('*, contacts(name)')
    .order('sent_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Outreach</h1>
          <p className="text-gray-500">{contacts?.length || 0} contacts · {messages?.length || 0} messages</p>
        </div>
        <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
          + Add Contact
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Contacts</h3>
          {!contacts?.length ? (
            <p className="text-sm text-gray-500">No contacts yet</p>
          ) : (
            <div className="space-y-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.company} · {c.title}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    c.relationship === 'responded' ? 'bg-green-100 text-green-700' :
                    c.relationship === 'connected' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{c.relationship}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Recent Messages</h3>
          {!messages?.length ? (
            <p className="text-sm text-gray-500">No messages yet</p>
          ) : (
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className="py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium capitalize bg-gray-100 px-1.5 py-0.5 rounded">{m.channel}</span>
                    <span className="text-xs text-gray-500">{m.contacts?.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400 ml-auto">{new Date(m.sent_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm truncate">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
