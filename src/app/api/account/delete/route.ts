import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({}))

  if (action === 'delete_account') {
    // Verify the user via SSR client (reads session cookie)
    const cookieStore = await cookies()
    const supabaseSSR = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    })

    const { data: { user }, error: authError } = await supabaseSSR.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Delete the auth user — profile and all FK-cascaded rows are removed by Postgres
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, supabaseServiceKey)
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
