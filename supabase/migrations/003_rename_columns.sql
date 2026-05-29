-- Rename DB columns to match code expectations
ALTER TABLE public.jobs RENAME COLUMN company TO company_name;
ALTER TABLE public.jobs RENAME COLUMN job_url TO url;
ALTER TABLE public.applications RENAME COLUMN applied_at TO applied_date;
