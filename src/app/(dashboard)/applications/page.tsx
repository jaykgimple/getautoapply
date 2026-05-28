import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/applications/KanbanBoard'

export default async function ApplicationsPage() {
  const supabase = createClient()
  const { data: apps } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-gray-500">{apps?.length || 0} applications tracked</p>
        </div>
      </div>
      <KanbanBoard applications={apps || []} />
    </div>
  )
}
