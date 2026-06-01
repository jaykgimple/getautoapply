-- Migration v0.3: Add follow-up tracking and overdue support to tracked_applications
-- Also add job enrichment result columns if not present

ALTER TABLE tracked_applications
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_note TEXT;

-- Add is_remote to jobs if not present
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;

-- Index for overdue followup queries
CREATE INDEX IF NOT EXISTS idx_tracked_app_next_followup ON tracked_applications(user_id, next_followup_at)
  WHERE next_followup_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_app_last_contact ON tracked_applications(user_id, last_contact_at);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY ga_job_stats;
