-- Migration: Add job-ops inspired features to existing jobs table
-- Run with: supabase db query --linked -f /root/projects/getautoapply/supabase/migrations/002_job_ops_features.sql

-- ── Jobs table: add missing columns for full pipeline tracking ──────────────

-- Application tracking (inspired by job-ops)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- Status pipeline: discovered → processing → ready → applied → in_progress → skipped/expired
-- We already have 'status' column — add constraint if not exists
-- The existing status enum might be different; let's make it flexible

-- CV/Resume tailoring fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suitability_score REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suitability_reason TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_brief TEXT;  -- AI-generated 1-paragraph summary
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_summary TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_headline TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_skills TEXT;  -- JSON array as text
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pdf_path TEXT;  -- path to generated PDF

-- Visa sponsorship
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sponsor_match_score REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sponsor_match_names TEXT;  -- JSON array

-- Enrichment metadata
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_industry TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_range TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS degree_required TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_level TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_function TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS listing_type TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS emails TEXT;  -- extracted emails

-- ── New table: application tracking (per job, per user) ─────────────────────
CREATE TABLE IF NOT EXISTS applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN (
        'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted'
    )),
    outcome TEXT CHECK (outcome IN (
        'pending', 'phone_screen', 'technical', 'final_round', 'offer_received',
        'offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'no_response'
    )),
    applied_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    cover_letter TEXT,
    resume_version TEXT,  -- which CV version was submitted
    notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- ── New table: stage events (history of application status changes) ────────
CREATE TABLE IF NOT EXISTS application_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: interviews ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    round_number INTEGER DEFAULT 1,
    interview_type TEXT CHECK (interview_type IN (
        'phone_screen', 'video', 'onsite', 'technical', 'behavioral',
        'take_home', 'presentation', 'final'
    )),
    scheduled_at TIMESTAMPTZ,
    duration_mins INTEGER,
    interviewer_names TEXT,
    notes TEXT,
    outcome TEXT CHECK (outcome IN ('pending', 'passed', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: post-application email tracking (Gmail integration) ─────────
CREATE TABLE IF NOT EXISTS application_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gmail_message_id TEXT,
    gmail_thread_id TEXT,
    subject TEXT,
    from_address TEXT,
    to_address TEXT,
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ,
    is_inbound BOOLEAN DEFAULT TRUE,
    classification TEXT CHECK (classification IN (
        'application_confirmation', 'recruiter_outreach', 'interview_invite',
        'interview_confirmation', 'offer', 'rejection', 'follow_up', 'other'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: user profile / CV data ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    headline TEXT,
    bio TEXT,
    location TEXT,
    website_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    years_experience INTEGER,
    preferred_roles TEXT[],  -- array of desired job titles
    preferred_locations TEXT[],
    remote_preference TEXT CHECK (remote_preference IN ('remote_only', 'hybrid', 'onsite', 'no_preference')),
    min_salary INTEGER,
    visa_required BOOLEAN DEFAULT FALSE,
    resume_json JSONB,  -- structured resume data
    resume_text TEXT,  -- parsed plain-text resume
    skills TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: experience bank (for CV tailoring) ─────────────────────────
CREATE TABLE IF NOT EXISTS experience_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    company TEXT,
    description TEXT,
    skills_used TEXT[],
    highlights TEXT[],
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    is_highlighted BOOLEAN DEFAULT FALSE,  -- frequently used in tailored CVs
    usage_count INTEGER DEFAULT 0,  -- how many times used in applications
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: education ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree TEXT,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    gpa TEXT,
    highlights TEXT[],
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: job notes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New table: Gmail watch tokens (for post-application tracking) ──────────
CREATE TABLE IF NOT EXISTS gmail_watches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gmail_access_token TEXT,
    gmail_refresh_token TEXT,
    gmail_token_expiry TIMESTAMPTZ,
    watch_active BOOLEAN DEFAULT FALSE,
    last_history_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_application_emails_app_id ON application_emails(application_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_classification ON application_emails(classification);
CREATE INDEX IF NOT EXISTS idx_job_notes_job_id ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_user_id ON job_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_items_user_id ON experience_items(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_suitability_score ON jobs(suitability_score) WHERE suitability_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_sponsor_score ON jobs(sponsor_match_score) WHERE sponsor_match_score IS NOT NULL;

-- ── Updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_job_notes_updated_at ON job_notes;
CREATE TRIGGER update_job_notes_updated_at BEFORE UPDATE ON job_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Stale job cleanup: mark jobs not seen in 30 days as expired ─────────────
-- This is a materialized view we can refresh periodically
CREATE MATERIALIZED VIEW IF NOT EXISTS job_health AS
SELECT
    source,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
    COUNT(*) FILTER (WHERE status = 'expired') as expired_jobs,
    MAX(last_seen_at) as last_scraped_at
FROM jobs
GROUP BY source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_health_source ON job_health(source);
