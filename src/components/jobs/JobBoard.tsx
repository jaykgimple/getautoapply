'use client'

import { useState } from 'react'
import type { Job } from '@/types/database'

const STATUS_COLORS: Record<string, string> = {
  saved: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-green-100 text-green-700',
  offer: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function JobBoard({ jobs }: { jobs: Job[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'saved', 'applied', 'interview', 'offer', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${
              filter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s} {s === 'all' ? `(${jobs.length})` : `(${jobs.filter(j => j.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <p className="text-gray-500">No jobs yet. Add your first job to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(job => (
            <div key={job.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{job.title}</h3>
                  <p className="text-sm text-gray-500">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {job.match_score != null && (
                    <span className="text-xs font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                      {Math.round(job.match_score * 100)}% match
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[job.status] || 'bg-gray-100'}`}>
                    {job.status}
                  </span>
                </div>
              </div>
              {job.salary_min && (
                <p className="text-xs text-gray-400 mt-1">
                  ${job.salary_min.toLocaleString()}{job.salary_max ? ` - $${job.salary_max.toLocaleString()}` : '+'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
