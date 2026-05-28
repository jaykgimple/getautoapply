import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: jobs } = await supabase.from('jobs').select('id, status').limit(1000)
  const { data: applications } = await supabase.from('applications').select('id, status').limit(1000)
  const { data: contacts } = await supabase.from('contacts').select('id').limit(1000)

  const stats = {
    saved: jobs?.filter(j => j.status === 'saved').length || 0,
    applied: applications?.filter(a => a.status === 'submitted').length || 0,
    interviews: applications?.filter(a => a.status === 'interview').length || 0,
    offers: applications?.filter(a => a.status === 'offer').length || 0,
    contacts: contacts?.length || 0,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Your job search at a glance</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">Saved Jobs</p>
          <p className="text-3xl font-bold mt-1">{stats.saved}</p>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">Applications</p>
          <p className="text-3xl font-bold mt-1">{stats.applied}</p>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">Interviews</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{stats.interviews}</p>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <p className="text-sm text-gray-500">Offers</p>
          <p className="text-3xl font-bold mt-1 text-orange-500">{stats.offers}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/jobs" className="block text-sm text-orange-500 hover:text-orange-600 font-medium">
              → Browse Jobs
            </Link>
            <Link href="/applications" className="block text-sm text-orange-500 hover:text-orange-600 font-medium">
              → View Pipeline
            </Link>
            <Link href="/resumes" className="block text-sm text-orange-500 hover:text-orange-600 font-medium">
              → Manage Resumes
            </Link>
            <Link href="/outreach" className="block text-sm text-orange-500 hover:text-orange-600 font-medium">
              → Outreach
            </Link>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Network</h3>
          <p className="text-sm text-gray-500">{stats.contacts} contacts tracked</p>
          <Link href="/outreach" className="text-sm text-sm text-orange-500 hover:text-orange-600 font-medium mt-2 inline-block">
            → Manage contacts
          </Link>
        </div>
      </div>
    </div>
  )
}
