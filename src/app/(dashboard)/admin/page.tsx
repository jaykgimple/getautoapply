'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type UserRole = 'admin' | 'candidate' | 'recruiter'

interface UserInfo {
  id: string
  email: string
  roles: UserRole[]
  profile: any
}

export default function AdminPanel() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'jobs' | 'system'>('users')

  const checkAdmin = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/login'); return }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
    const roleList: UserRole[] = (roles || []).map(r => r.role as UserRole)

    // Auto-seed admin for jaykgimple@gmail.com
    if (!roleList.includes('admin') && session.user.email === 'jaykgimple@gmail.com') {
      await supabase.from('user_roles').upsert({ user_id: session.user.id, role: 'admin' })
      roleList.push('admin')
    }

    if (!roleList.includes('admin')) {
      router.push('/dashboard')
      return
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setUser({ id: session.user.id, email: session.user.email || '', roles: roleList, profile })
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select(`
      id, email, full_name, created_at, last_active_at, linkedin_connected, is_seeking, seeking_status,
      user_roles(role)
    `).order('created_at', { ascending: false }).limit(100)
    setUsers(data || [])
    setLoading(false)
  }

  const assignRole = async (userId: string, role: string) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role })
    loadUsers()
  }

  const removeRole = async (userId: string, role: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
    loadUsers()
  }

  useEffect(() => { checkAdmin() }, [checkAdmin])

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading admin...</div>
  if (!user) return null

  const bg = 'var(--bg-base)'
  const card = 'var(--bg-elevated)'
  const text = 'var(--text-primary)'
  const muted = 'var(--text-secondary)'
  const border = 'var(--border)'
  const brand = 'var(--brand)'

  return (
    <div className="min-h-screen" style={{ background: bg, color: text }}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: muted }}>Logged in as {user.email}</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg text-sm" style={{ background: card, border: `1px solid ${border}` }}>
            ← Back to Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['users', 'analytics', 'jobs', 'system'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{ background: activeTab === tab ? brand : card, color: activeTab === tab ? '#000' : text, border: `1px solid ${activeTab === tab ? brand : border}` }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
            <div className="p-4 border-b" style={{ borderColor: border }}>
              <h2 className="font-semibold">User Management ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: bg }}>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Email</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Name</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Roles</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>LinkedIn</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Seeking</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Joined</th>
                    <th className="text-left p-3 font-medium" style={{ color: muted }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t" style={{ borderColor: border }}>
                      <td className="p-3 font-mono text-xs">{u.email}</td>
                      <td className="p-3">{u.full_name || '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {(u.user_roles || []).map((r: any) => (
                            <span key={r.role} className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: r.role === 'admin' ? '#ff4444' + '20' : '#44ff44' + '20', color: r.role === 'admin' ? '#ff4444' : '#44ff44' }}>
                              {r.role}
                            </span>
                          ))}
                          {(!u.user_roles || u.user_roles.length === 0) && <span style={{ color: muted }}>none</span>}
                        </div>
                      </td>
                      <td className="p-3">{u.linkedin_connected ? '✅' : '—'}</td>
                      <td className="p-3">{u.seeking_status ? u.seeking_status.replace(/_/g, ' ') : '—'}</td>
                      <td className="p-3 text-xs" style={{ color: muted }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {!u.user_roles?.find((r: any) => r.role === 'admin') && (
                            <button onClick={() => assignRole(u.id, 'admin')} className="px-2 py-1 rounded text-xs" style={{ background: '#ff444420', color: '#ff4444' }}>+admin</button>
                          )}
                          {u.user_roles?.find((r: any) => r.role === 'admin') && (
                            <button onClick={() => removeRole(u.id, 'admin')} className="px-2 py-1 rounded text-xs" style={{ background: '#ff444420', color: '#ff4444' }}>-admin</button>
                          )}
                          {!u.user_roles?.find((r: any) => r.role === 'candidate') && (
                            <button onClick={() => assignRole(u.id, 'candidate')} className="px-2 py-1 rounded text-xs" style={{ background: '#4444ff20', color: '#4444ff' }}>+candidate</button>
                          )}
                          {u.user_roles?.find((r: any) => r.role === 'candidate') && (
                            <button onClick={() => removeRole(u.id, 'candidate')} className="px-2 py-1 rounded text-xs" style={{ background: '#4444ff20', color: '#4444ff' }}>-candidate</button>
                          )}
                          {!u.user_roles?.find((r: any) => r.role === 'recruiter') && (
                            <button onClick={() => assignRole(u.id, 'recruiter')} className="px-2 py-1 rounded text-xs" style={{ background: '#44aa4420', color: '#44aa44' }}>+recruiter</button>
                          )}
                          {u.user_roles?.find((r: any) => r.role === 'recruiter') && (
                            <button onClick={() => removeRole(u.id, 'recruiter')} className="px-2 py-1 rounded text-xs" style={{ background: '#44aa4420', color: '#44aa44' }}>-recruiter</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Users" value={users.length.toString()} color={brand} />
            <StatCard title="LinkedIn Connected" value={users.filter(u => u.linkedin_connected).length.toString()} color="#0077b5" />
            <StatCard title="Active Seekers" value={users.filter(u => u.is_seeking).length.toString()} color="#44aa44" />
            <StatCard title="Admins" value={users.filter(u => u.user_roles?.find((r: any) => r.role === 'admin')).length.toString()} color="#ff4444" />
            <StatCard title="Candidates" value={users.filter(u => u.user_roles?.find((r: any) => r.role === 'candidate')).length.toString()} color="#4444ff" />
            <StatCard title="Recruiters" value={users.filter(u => u.user_roles?.find((r: any) => r.role === 'recruiter')).length.toString()} color="#44aa44" />
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <AdminJobs />
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="rounded-xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
            <h2 className="font-semibold mb-4">System Info</h2>
            <div className="space-y-2 text-sm" style={{ color: muted }}>
              <p>Admin: {user.email}</p>
              <p>User ID: {user.id}</p>
              <p>Total users in system: {users.length}</p>
              <p>Your roles: {user.roles.join(', ')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function AdminJobs() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => setJobs(data || []))
  }, [])

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold">Jobs in System ({jobs.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-base)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Title</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Company</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Source</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Added</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="p-3">{j.title}</td>
                <td className="p-3">{j.company}</td>
                <td className="p-3">{j.source || 'manual'}</td>
                <td className="p-3">{j.status}</td>
                <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(j.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
