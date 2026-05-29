-- Add generated column aliases so code using company_name, url, applied_date works
-- Jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_name TEXT GENERATED ALWAYS AS (company) STORED;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS url TEXT GENERATED ALWAYS AS (job_url) STORED;

-- Applications table  
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS applied_date TIMESTAMPTZ GENERATED ALWAYS AS (applied_at) STORED;

-- Generated columns are read-only, so for INSERT/UPDATE we need to use the real columns.
-- The client-side code sends data using the real column names (company, job_url, applied_at)
-- because it reads from DB rows which have those names.
-- The company_name / url / aliases are only used in SELECT queries and client-side display.
