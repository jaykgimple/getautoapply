import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const signUp = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('full_name') as string
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    if (error) {
      redirect('/signup?error=' + encodeURIComponent(error.message))
    }
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">JB</span>
            </div>
            <span className="font-bold text-2xl">JobBoxOS</span>
          </Link>
        </div>
        <div className="bg-white border rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-6">Create your account</h1>
          <form action={signUp} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium mb-1">Full Name</label>
              <input id="full_name" name="full_name" type="text" required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" name="email" type="email" required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input id="password" name="password" type="password" required minLength={6}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Min 6 characters" />
            </div>
            <button type="submit"
              className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600">
              Create Account
            </button>
          </form>
          <p className="mt-4 text-sm text-center text-gray-600">
            Already have an account? <Link href="/login" className="text-orange-500 font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
