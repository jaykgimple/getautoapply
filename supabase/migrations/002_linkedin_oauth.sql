-- LinkedIn OAuth profile enrichment
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_id TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_headline TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_summary TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_raw_profile JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linkedin_token TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_linkedin ON public.profiles(linkedin_id) WHERE linkedin_connected = true;
