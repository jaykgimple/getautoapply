import { createClient } from '@/lib/supabase/server'
import JobBoard from '@/components/jobs/JobBoard'

export default async function JobsPage() {
  const supabase = createClient()
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('match_score', { ascending: false, nullsFirst: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-gray-500">{jobs?.length || 0} jobs found</p>
        </div>
        <AddJobButton />
      </div>
      <JobBoard jobs={jobs || []} />
    </div>
  )
}

function AddJobButton() {
  return (
    <button
      className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
      onClick={() => {
        const url = prompt('Enter job URL:')
        if (url) fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_url: url, title: 'New Job', company: 'Unknown' }) }).then(() => location.reload())
      }}
    >
      + Add Job
    </button>
  )
}
