-- Job sourcing feature: add columns for external job data
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS job_type TEXT,
  ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;

-- Index for faster search by source
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs(user_id, source);
CREATE INDEX IF NOT EXISTS idx_jobs_remote ON public.jobs(user_id, is_remote) WHERE is_remote = true;
