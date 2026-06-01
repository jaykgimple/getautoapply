-- Migration 007: Platform overhaul - Roles, Admin, Job Scourcing, AI Matching, Anti-Black-Hole

-- Enable pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'candidate', 'recruiter')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- RLS for user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Updated profiles with role info and last active tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_seeking boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seeking_status TEXT CHECK (seeking_status IN ('actively_looking', 'open', 'not_looking')) DEFAULT 'not_looking';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_roles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_locations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_min INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_max INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_connected boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_headline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_profile_image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_raw_profile JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_seeking ON public.profiles(seeking_status) WHERE is_seeking = true;
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC NULLS LAST);

-- Candidate profiles (extends base profile)
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT,
  summary TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  resume_url TEXT,
  resume_text TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  remote_preference TEXT CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'no_preference')) DEFAULT 'no_preference',
  availability TEXT CHECK (availability IN ('immediately', 'two_weeks', 'one_month', 'more_than_month')) DEFAULT 'two_weeks',
  is_open_to_work boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Candidates own profile" ON public.candidate_profiles;
CREATE POLICY "Candidates own profile" ON public.candidate_profiles FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Recruiters can view candidates" ON public.candidate_profiles;
CREATE POLICY "Recruiters can view candidates" ON public.candidate_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'recruiter')
);

-- Recruiter profiles
CREATE TABLE IF NOT EXISTS public.recruiter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_url TEXT,
  company_size TEXT,
  hiring_roles JSONB DEFAULT '[]'::jsonb,
  is_agency boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters own profile" ON public.recruiter_profiles;
CREATE POLICY "Recruiters own profile" ON public.recruiter_profiles FOR ALL USING (auth.uid() = user_id);

-- Jobs table: add missing columns to existing table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS raw_description TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_type TEXT CHECK (job_type IN ('full_time', 'part_time', 'contract', 'internship', 'temporary', 'freelance'));
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS remote_type TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite'));
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scraped_from TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scraped_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS posted_date DATE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS skills_required JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE INDEX IF NOT EXISTS idx_jobs_scraped ON public.jobs(scraped_from, posted_date DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_active ON public.jobs(is_active, posted_date DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_search ON public.jobs USING GIN(search_vector);

-- Application tracking (anti-black-hole system)
CREATE TABLE IF NOT EXISTS public.application_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_url TEXT,
  status TEXT CHECK (status IN ('saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn')) DEFAULT 'saved',
  applied_date TIMESTAMPTZ,
  last_response_date TIMESTAMPTZ,
  next_followup_date TIMESTAMPTZ,
  followup_count integer DEFAULT 0,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  resume_version TEXT,
  cover_letter_used boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_tracking_user ON public.application_tracking(user_id, status);
CREATE INDEX IF NOT EXISTS idx_app_tracking_followup ON public.application_tracking(next_followup_date) WHERE status IN ('applied', 'screening');
CREATE INDEX IF NOT EXISTS idx_app_tracking_ghosted ON public.application_tracking(status) WHERE status = 'ghosted';

ALTER TABLE public.application_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own tracking" ON public.application_tracking;
CREATE POLICY "Users own tracking" ON public.application_tracking FOR ALL USING (auth.uid() = user_id);

-- Follow-up message templates
CREATE TABLE IF NOT EXISTS public.followup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  days_after integer NOT NULL DEFAULT 7,
  is_default boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.followup_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own templates" ON public.followup_templates;
CREATE POLICY "Users own templates" ON public.followup_templates FOR ALL USING (auth.uid() = user_id);

-- Insert default follow-up templates for new users
-- (Will be handled by the app on signup)

-- AI matching: recruiter job descriptions ↔ candidates
CREATE TABLE IF NOT EXISTS public.ai_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_description TEXT,
  match_score NUMERIC(4,3) CHECK (match_score >= 0 AND match_score <= 1),
  match_reasons JSONB DEFAULT '[]'::jsonb,
  skills_matched JSONB DEFAULT '[]'::jsonb,
  status TEXT CHECK (status IN ('pending', 'contacted', 'interviewing', 'hired', 'rejected')) DEFAULT 'pending',
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_matches_recruiter ON public.ai_matches(recruiter_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_matches_candidate ON public.ai_matches(candidate_id, match_score DESC);

ALTER TABLE public.ai_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters view own matches" ON public.ai_matches;
CREATE POLICY "Recruiters view own matches" ON public.ai_matches FOR ALL USING (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Candidates view own matches" ON public.ai_matches;
CREATE POLICY "Candidates view own matches" ON public.ai_matches FOR SELECT USING (auth.uid() = candidate_id);

-- Job alerts
CREATE TABLE IF NOT EXISTS public.job_alerts_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT,
  location TEXT,
  remote_only boolean DEFAULT false,
  min_salary INTEGER,
  job_type TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'instant')) DEFAULT 'daily',
  is_active boolean DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_alerts_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own alerts" ON public.job_alerts_v2;
CREATE POLICY "Users own alerts" ON public.job_alerts_v2 FOR ALL USING (auth.uid() = user_id);

-- Connection network (warm intros)
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  relationship TEXT CHECK (relationship IN ('colleague', 'manager', 'referral', 'contact', 'other')),
  notes TEXT,
  can_introduce boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own connections" ON public.connections;
CREATE POLICY "Users own connections" ON public.connections FOR ALL USING (auth.uid() = user_id);

-- Application analytics (black hole metrics)
CREATE TABLE IF NOT EXISTS public.application_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  total_applications integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  total_interviews integer DEFAULT 0,
  total_offers integer DEFAULT 0,
  avg_days_to_response NUMERIC(5,1),
  last_application_date DATE,
  response_rate NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.application_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own analytics" ON public.application_analytics;
CREATE POLICY "Users own analytics" ON public.application_analytics FOR ALL USING (auth.uid() = user_id);

-- Update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS candidate_profiles_updated_at ON public.candidate_profiles;
CREATE TRIGGER candidate_profiles_updated_at BEFORE UPDATE ON public.candidate_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS recruiter_profiles_updated_at ON public.recruiter_profiles;
CREATE TRIGGER recruiter_profiles_updated_at BEFORE UPDATE ON public.recruiter_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS application_tracking_updated_at ON public.application_tracking;
CREATE TRIGGER application_tracking_updated_at BEFORE UPDATE ON public.application_tracking FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed admin role for jaykgimple@gmail.com
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'jaykgimple@gmail.com';
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE NOTICE 'Admin role assigned to jaykgimple@gmail.com';
  ELSE
    RAISE NOTICE 'User jaykgimple@gmail.com not found yet - admin role will be assigned on first login';
  END IF;
END $$;
