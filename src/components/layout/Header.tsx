import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface HeaderProps {
  user: { email?: string | null } | null
}

export default async function Header({ user }: HeaderProps) {
  const supabase = createClient()

  const signOut = async () => {
    'use server'
    const sb = createClient()
    await sb.auth.signOut()
    redirect('/login')
  }

  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user?.email}</span>
        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
          <span className="text-orange-600 font-semibold text-sm">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </div>
    </header>
  )
}
