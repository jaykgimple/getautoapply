-- JobBoxOS Initial Schema
-- Phase 1: Auth, Jobs, Applications, Resumes, Contacts, Outreach

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  headline TEXT,
  location TEXT,
  resume_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  job_url TEXT NOT NULL,
  description TEXT,
  source TEXT DEFAULT 'manual',
  match_score REAL,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved','applied','interview','offer','rejected','archived')),
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','viewed','interview','offer','rejected','withdrawn')),
  resume_version TEXT,
  cover_letter TEXT,
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resumes
CREATE TABLE public.resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_master BOOLEAN DEFAULT false,
  content JSONB NOT NULL DEFAULT '{}',
  file_path TEXT,
  ats_score REAL,
  target_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  relationship TEXT DEFAULT 'cold' CHECK (relationship IN ('cold','warm','connected','responded','referred')),
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Outreach Messages
CREATE TABLE public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('linkedin','email','other')),
  direction TEXT CHECK (direction IN ('sent','received')),
  subject TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  reply_received BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_jobs_user_status ON public.jobs(user_id, status);
CREATE INDEX idx_jobs_match ON public.jobs(user_id, match_score DESC NULLS LAST);
CREATE INDEX idx_applications_user ON public.applications(user_id, created_at DESC);
CREATE INDEX idx_resumes_user ON public.resumes(user_id, is_master);
CREATE INDEX idx_contacts_user ON public.contacts(user_id, company);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own jobs" ON public.jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own applications" ON public.applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own resumes" ON public.resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own outreach" ON public.outreach_messages FOR ALL USING (auth.uid() = user_id);

-- Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf','text/plain','application/json'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users own resume files" ON storage.objects
  FOR ALL USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
