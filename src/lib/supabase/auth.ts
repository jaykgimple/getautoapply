import { createClient } from './client'

export type UserRole = 'admin' | 'candidate' | 'recruiter'

export interface UserWithRoles {
  id: string
  email: string
  roles: UserRole[]
  isAdmin: boolean
  isCandidate: boolean
  isRecruiter: boolean
}

export async function getCurrentUserWithRoles(): Promise<UserWithRoles | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  const roleList: UserRole[] = (roles || []).map(r => r.role as UserRole)

  return {
    id: user.id,
    email: user.email || '',
    roles: roleList,
    isAdmin: roleList.includes('admin'),
    isCandidate: roleList.includes('candidate'),
    isRecruiter: roleList.includes('recruiter'),
  }
}

export async function hasRole(role: UserRole): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('role', role)
    .single()
  return !!data
}

export async function assignRole(userId: string, role: UserRole): Promise<void> {
  const supabase = createClient()
  await supabase.from('user_roles').upsert({ user_id: userId, role })
}

export async function removeRole(userId: string, role: UserRole): Promise<void> {
  const supabase = createClient()
  await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
}

// Helper to get/create user profile
export async function getOrCreateProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (existing) return existing

  // Create profile if doesn't exist
  const { data: created } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  return created
}

// Update last active
export async function updateLastActive() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id)
}
