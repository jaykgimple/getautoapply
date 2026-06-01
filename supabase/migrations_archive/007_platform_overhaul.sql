-- Migration 007: Platform overhaul - Roles, Admin, Job Scraping, AI Matching, Anti-Black-Hole
-- Part 1: Roles & Admin System

-- Enable pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'candidate', 'recruiter')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- RLS for user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
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
-- LinkedIn OAuth fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_connected boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_headline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_summary TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_profile_image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_raw_profile JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMPTZ;

-- Extended profile for candidates
CREATE TABLE public.candidate_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  skills JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  work_authorization TEXT DEFAULT 'US Citizen' CHECK (work_authorization IN ('US Citizen', 'Permanent Resident', 'Work Visa', 'Sponsorship Required', 'Other')),
  remote_preference TEXT DEFAULT 'hybrid' CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')),
  years_experience INTEGER DEFAULT 0,
  resume_text TEXT,
  resume_embedding vector(1536),
  availability TEXT DEFAULT 'immediately' CHECK (availability IN ('immediately', '2_weeks', '1_month', 'more_than_1_month')),
  contact_email TEXT,
  phone TEXT,
  location_timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidates own profile" ON public.candidate_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Recruiters can view candidates" ON public.candidate_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'recruiter')
);

-- Recruiter profiles
CREATE TABLE public.recruiter_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_website TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  company_industry TEXT,
  hiring_for_roles JSONB DEFAULT '[]'::jsonb,
  company_description TEXT,
  is_verified boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters own profile" ON public.recruiter_profiles FOR ALL USING (auth.uid() = id);

-- Part 2: Enhanced Jobs with AI Matching

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description_embedding vector(1536);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS raw_description TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_type TEXT CHECK (job_type IN ('full_time', 'part_time', 'contract', 'freelance', 'internship', 'temporary')) DEFAULT 'full_time';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS remote_type TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite')) DEFAULT 'onsite';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scraped_from TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scraped_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS posted_date DATE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX idx_jobs_scraped ON public.jobs(scraped_from, posted_date DESC) WHERE scraped_from IS NOT NULL;
CREATE INDEX idx_jobs_active ON public.jobs(is_active, posted_date DESC) WHERE is_active = true;

-- Part 3: Application Tracking (Anti-Black-Hole)

CREATE TABLE public.application_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT,
  applied_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'applied' CHECK (status IN ('saved', 'applied', 'viewed', 'screening', 'interview_1', 'interview_2', 'interview_3', 'offer', 'rejected', 'withdrawn', 'ghosted')),
  last_status_change TIMESTAMPTZ DEFAULT now(),
  last_followup_sent TIMESTAMPTZ,
  followup_count INTEGER DEFAULT 0,
  next_followup_at TIMESTAMPTZ,
  response_received boolean DEFAULT false,
  response_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'scraped', 'linkedin', 'indeed', 'referral')),
  match_score REAL,
  resume_used_id UUID REFERENCES public.resumes(id),
  cover_letter_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_app_tracking_user ON public.application_tracking(user_id, status);
CREATE INDEX idx_app_tracking_followup ON public.application_tracking(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_app_tracking_ghosted ON public.application_tracking(status) WHERE status = 'ghosted';

ALTER TABLE public.application_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own tracking" ON public.application_tracking FOR ALL USING (auth.uid() = user_id);

-- Follow-up templates
CREATE TABLE public.followup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_after_application INTEGER NOT NULL DEFAULT 3,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_default boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.followup_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own templates" ON public.followup_templates FOR ALL USING (auth.uid() = user_id);

-- Part 4: AI Matching

CREATE TABLE public.ai_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  match_score REAL NOT NULL,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  skills_match JSONB DEFAULT '[]'::jsonb,
  experience_match JSONB DEFAULT '{}'::jsonb,
  recruiter_viewed boolean DEFAULT false,
  candidate_viewed boolean DEFAULT false,
  recruiter_interested boolean DEFAULT false,
  candidate_interested boolean DEFAULT false,
  message_sent boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_matches_recruiter ON public.ai_matches(recruiter_id, match_score DESC);
CREATE INDEX idx_ai_matches_candidate ON public.ai_matches(candidate_id, match_score DESC);

ALTER TABLE public.ai_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters view own matches" ON public.ai_matches FOR ALL USING (auth.uid() = recruiter_id);
CREATE POLICY "Candidates view own matches" ON public.ai_matches FOR SELECT USING (auth.uid() = candidate_id);

-- Part 5: Job Alerts & Saved Searches

CREATE TABLE public.job_alerts_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT,
  location TEXT,
  remote_type TEXT,
  job_type TEXT,
  salary_min INTEGER,
  sources JSONB DEFAULT '["all"]'::jsonb,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('instant', 'daily', 'weekly')),
  last_sent_at TIMESTAMPTZ,
  match_count INTEGER DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_alerts_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own alerts" ON public.job_alerts_v2 FOR ALL USING (auth.uid() = user_id);

-- Part 6: Warm Intro Network

CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_user_id TEXT,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  relationship_strength TEXT CHECK (relationship_strength IN ('1st_degree', '2nd_degree', '3rd_degree', 'recruiter', 'hiring_manager')),
  can_introduce boolean DEFAULT false,
  notes TEXT,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own connections" ON public.connections FOR ALL USING (auth.uid() = user_id);

-- Part 7: Application Analytics

CREATE TABLE public.application_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  applications_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  interviews_scheduled INTEGER DEFAULT 0,
  offers_received INTEGER DEFAULT 0,
  rejections INTEGER DEFAULT 0,
  ghosted INTEGER DEFAULT 0,
  avg_match_score REAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.application_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own analytics" ON public.application_analytics FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER candidate_profiles_updated_at BEFORE UPDATE ON public.candidate_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER recruiter_profiles_updated_at BEFORE UPDATE ON public.recruiter_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER application_tracking_updated_at BEFORE UPDATE ON public.application_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
