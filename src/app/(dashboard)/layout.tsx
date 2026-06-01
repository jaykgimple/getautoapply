'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: string
  roles?: string[] // If specified, only show for these roles
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/search', label: 'Find Jobs', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { href: '/jobs', label: 'My Jobs', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/applications', label: 'Applications', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/ghostwriter', label: 'Ghostwriter', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { href: '/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/outreach', label: 'Outreach', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
        setUserRoles((roles || []).map((r: any) => r.role))
      }
      setLoading(false)
    })
  }, [])

  // Filter nav items based on user roles
  const navItems = allNavItems.filter(item => {
    if (!item.roles) return true // Public items
    if (userRoles.includes('admin')) return true // Admin sees everything
    return item.roles.some(role => userRoles.includes(role))
  })

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <aside className="w-56 flex-shrink-0 border-r flex flex-col" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}>
        <div className="px-4 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-semibold text-xs" style={{ background: 'var(--brand)' }}>GA</div>
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>GetAutoApply</span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)', background: isActive ? 'var(--bg-surface)' : 'transparent' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="text-[12px] transition-colors hover:underline block" style={{ color: 'var(--text-quaternary)' }}>← Back to site</Link>
          <button
            onClick={async () => {
              const sb = createClient()
              await sb.auth.signOut()
              window.location.href = '/login'
            }}
            className="text-[12px] transition-colors hover:underline mt-1.5 block w-full text-left"
            style={{ color: 'var(--text-quaternary)' }}>
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
