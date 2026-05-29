-- ============================================
-- GetAutoApply DB Schema Fix Migration
-- Renames columns to match code expectations
-- ============================================

-- 1. JOBS TABLE
ALTER TABLE public.jobs RENAME COLUMN company TO company_name;
ALTER TABLE public.jobs RENAME COLUMN job_url TO url;
ALTER TABLE public.jobs ALTER COLUMN url DROP NOT NULL;
ALTER TABLE public.jobs RENAME COLUMN applied_at TO applied_date;

-- 2. APPLICATIONS TABLE
ALTER TABLE public.applications RENAME COLUMN job_title TO title;
ALTER TABLE public.applications RENAME COLUMN applied_at TO applied_date;

-- 3. RESUMES TABLE
ALTER TABLE public.resumes RENAME COLUMN is_master TO is_default;

-- 4. CONTACTS TABLE: rename relationship -> status to match code
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_relationship_check;
ALTER TABLE public.contacts RENAME COLUMN relationship TO status;
ALTER TABLE public.contacts ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE public.contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN ('new', 'contacted', 'responded', 'connected', 'not_interested', 'cold', 'warm', 'referred'));

-- 5. OUTREACH_MESSAGES TABLE: rename body -> content to match code
ALTER TABLE public.outreach_messages RENAME COLUMN body TO content;

-- 6. Add user_id to outreach_messages if missing (code sends it)
-- Already has user_id per schema, just ensuring

-- 7. Add missing LinkedIn OAuth columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_id TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_headline TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_summary TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_raw_profile JSONB,
  ADD COLUMN IF NOT EXISTS linkedin_token TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMPTZ;

-- 8. Performance indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON public.jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON public.applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_contact ON public.outreach_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON public.resumes(user_id);
