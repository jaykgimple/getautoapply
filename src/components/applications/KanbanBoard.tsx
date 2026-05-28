'use client'

import { useState } from 'react'
import type { Application } from '@/types/database'

const COLUMNS = [
  { id: 'draft', label: 'Draft', color: 'bg-gray-100' },
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-100' },
  { id: 'interview', label: 'Interview', color: 'bg-yellow-100' },
  { id: 'offer', label: 'Offer', color: 'bg-green-100' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-100' },
]

export default function KanbanBoard({ applications }: { applications: Application[] }) {
  const getColumnApps = (status: string) => applications.filter(a => a.status === status)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colApps = getColumnApps(col.id)
        return (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className={`${col.color} rounded-t-lg px-4 py-2`}>
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <span className="text-xs text-gray-500">{colApps.length}</span>
            </div>
            <div className="bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-48 border border-t-0">
              {colApps.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No applications</p>
              ) : (
                colApps.map(app => (
                  <div key={app.id} className="bg-white border rounded-lg p-3 text-sm hover:shadow-sm">
                    <p className="font-medium">{app.job_title}</p>
                    <p className="text-xs text-gray-500">{app.company}</p>
                    {app.applied_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
