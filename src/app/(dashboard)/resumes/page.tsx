import { createClient } from '@/lib/supabase/server'

export default async function ResumesPage() {
  const supabase = createClient()
  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .order('is_master', { ascending: false })

  const master = resumes?.find(r => r.is_master)
  const tailored = resumes?.filter(r => !r.is_master) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumes</h1>
          <p className="text-gray-500">Master resume + tailored variants</p>
        </div>
        <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
          + New Resume
        </button>
      </div>

      {master && (
        <div className="bg-white border-2 border-orange-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">MASTER</span>
            <h3 className="font-semibold">{master.name}</h3>
          </div>
          <p className="text-sm text-gray-500">
            {master.content && typeof master.content === 'object'
              ? `${Object.keys(master.content).length} sections configured`
              : 'Click to edit'}
          </p>
        </div>
      )}

      <h2 className="font-semibold text-lg">Tailored Variants ({tailored.length})</h2>
      {tailored.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No tailored resumes yet. Tailor your master resume for a specific job to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tailored.map(r => (
            <div key={r.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{r.name}</p>
                {r.ats_score != null && (
                  <p className="text-xs text-gray-500">ATS Score: {Math.round(r.ats_score * 100)}%</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
