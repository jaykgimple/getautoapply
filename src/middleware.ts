import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/admin', '/recruiter', '/tracker', '/matches', '/settings', '/jobs', '/applications', '/resumes', '/search', '/outreach', '/calendar']

// Routes restricted by role
const roleRoutes: Record<string, string[]> = {
  '/admin': ['admin'],
  '/recruiter': ['admin', 'recruiter'],
  '/tracker': ['admin', 'candidate'],
  '/matches': ['admin', 'recruiter'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route is protected
  const isProtected = protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  if (!isProtected) return NextResponse.next()

  // Create a response to modify
  const response = NextResponse.next()

  // Create server client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Get the session
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect to login if not authenticated
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check role-based access
  const requiredRoles = roleRoutes[pathname]
  if (requiredRoles) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)

    const userRoles = (roles || []).map((r: any) => r.role)
    const hasAccess = requiredRoles.some(role => userRoles.includes(role))

    if (!hasAccess) {
      // Redirect to dashboard if user doesn't have the required role
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/recruiter/:path*',
    '/tracker/:path*',
    '/matches/:path*',
    '/settings/:path*',
    '/jobs/:path*',
    '/applications/:path*',
    '/resumes/:path*',
    '/search/:path*',
    '/outreach/:path*',
    '/calendar/:path*',
  ],
}
