import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">JB</span>
          </div>
          <span className="font-bold text-xl">JobBoxOS</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Log in</Link>
          <Link href="/signup" className="text-sm font-medium bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600">Sign up</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Your AI-Powered Job Search OS
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Source jobs, auto-fill applications, tailor resumes with AI, track your pipeline, and manage outreach — all in one platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-orange-600">
              Get Started Free
            </Link>
            <a href="#features" className="text-gray-600 px-8 py-3 rounded-lg font-semibold text-lg hover:text-gray-900 border">
              Learn More
            </a>
          </div>

          <div id="features" className="mt-16 grid grid-cols-3 gap-8 text-left">
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">Smart Job Sourcing</h3>
              <p className="text-sm text-gray-600">AI-powered matching scores every job against your profile. Focus on what fits.</p>
            </div>
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">One-Click Apply</h3>
              <p className="text-sm text-gray-600">Chrome extension auto-fills applications on LinkedIn, Indeed, Greenhouse, Lever, and 500+ ATS platforms.</p>
            </div>
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">AI Resume Tailoring</h3>
              <p className="text-sm text-gray-600">Generates ATS-optimized resume variants matched to each job description. Per-application, not one-size-fits-all.</p>
            </div>
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">Pipeline Dashboard</h3>
              <p className="text-sm text-gray-600">Kanban board tracking every application from draft to offer. Never lose track again.</p>
            </div>
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">Outreach Engine</h3>
              <p className="text-sm text-gray-600">Personalized LinkedIn messages and cold emails. Automated follow-ups. Relationship CRM.</p>
            </div>
            <div className="p-6 border rounded-xl">
              <h3 className="font-semibold mb-2">Analytics</h3>
              <p className="text-sm text-gray-600">Response rates by role, company, day of week. Know what&apos;s working and double down.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white px-6 py-6 text-center text-sm text-gray-500">
        JobBoxOS v0.1 — Built for job seekers, by job seekers.
      </footer>
    </div>
  )
}
