-- GetAutoApply Migration v0.2 — Full Job Operations Pipeline
-- Adds application tracking, CV tailoring, interview pipeline, and email monitoring
-- Inspired by DevOps-for-job-hunting architecture patterns
-- Run: supabase db query --linked -f supabase/migrations/002_job_ops_pipeline.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- ENHANCE EXISTING JOBS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Suitability scoring (AI match score 0-100)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_score_ai REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_reasoning TEXT;

-- AI-generated brief/summary for quick scanning
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- CV tailoring outputs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_summary TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_headline TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_skills TEXT;  -- JSON text array
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tailored_resume_path TEXT;  -- S3/local path to generated PDF

-- Visa / sponsorship detection
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visa_sponsor_score REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visa_sponsor_companies TEXT;  -- JSON text array of known sponsors

-- Company enrichment
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_industry TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Job metadata
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_level TEXT;  -- entry, mid, senior, staff, executive
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type TEXT;  -- full_time, part_time, contract, freelance
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS degree_required TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_deadline TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_emails TEXT;  -- extracted emails JSON array

-- ═══════════════════════════════════════════════════════════════════════════
-- APPLICATION TRACKING (full pipeline per user per job)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tracked_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    pipeline_stage TEXT NOT NULL DEFAULT 'saved' CHECK (pipeline_stage IN (
        'saved',       -- bookmarked, not yet applied
        'applied',     -- application submitted
        'screening',   -- phone/initial screen
        'interviewing', -- in interview rounds
        'offer',       -- offer received
        'accepted',    -- offer accepted
        'rejected',    -- rejected at any stage
        'withdrawn',   -- user withdrew
        'ghosted'      -- no response after 30+ days
    )),
    outcome TEXT CHECK (outcome IN (
        'pending', 'phone_screen', 'technical', 'take_home', 'final_round',
        'offer_received', 'offer_accepted', 'offer_declined',
        'rejected_after_screen', 'rejected_after_interview', 'rejected_after_final',
        'withdrawn', 'no_response'
    )),
    applied_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    cover_letter_used TEXT,
    resume_version_submitted TEXT,
    is_starred BOOLEAN DEFAULT FALSE,
    user_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- Stage transition history (full audit trail)
CREATE TABLE IF NOT EXISTS application_stage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES tracked_applications(id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INTERVIEW SCHEDULING
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS interview_rounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES tracked_applications(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    round_type TEXT NOT NULL CHECK (round_type IN (
        'recruiter_screen', 'hiring_manager', 'technical_screen',
        'coding_challenge', 'take_home', 'system_design',
        'behavioral', 'panel', 'onsite', 'final', 'culture_fit'
    )),
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    interviewer_names TEXT,
    interview_link TEXT,  -- video call URL
    prep_notes TEXT,      -- user's prep notes
    debrief_notes TEXT,   -- notes after interview
    outcome TEXT CHECK (outcome IN ('scheduled', 'completed', 'cancelled', 'no_show', 'passed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-APPLICATION EMAIL MONITORING (Gmail integration)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS application_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES tracked_applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT,
    subject_line TEXT,
    sender_address TEXT,
    recipient_address TEXT,
    body_plain TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    email_category TEXT CHECK (email_category IN (
        'application_submitted',
        'application_received',
        'recruiter_outreach',
        'interview_invitation',
        'interview_confirmation',
        'interview_followup',
        'offer_letter',
        'rejection',
        'rejection_after_interview',
        'check_in',
        'other'
    )),
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER PROFILE & CV DATA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_job_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    professional_headline TEXT,
    about_me TEXT,
    location TEXT,
    personal_website TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    years_experience INTEGER,
    desired_job_titles TEXT[],
    desired_locations TEXT[],
    remote_preference TEXT CHECK (remote_preference IN ('remote_only', 'hybrid_ok', 'onsite_ok', 'no_preference')),
    min_salary_usd INTEGER,
    visa_sponsorship_needed BOOLEAN DEFAULT FALSE,
    visa_type TEXT,  -- e.g. 'H1B', 'Tier 2', etc.
    resume_markdown TEXT,  -- full resume in markdown
    resume_json JSONB,     -- structured JSON resume
    resume_plaintext TEXT, -- plain text for ATS scanning
    core_skills TEXT[],
    languages TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experience items (for dynamic CV tailoring)
CREATE TABLE IF NOT EXISTS work_history_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_url TEXT,
    location TEXT,
    role_description TEXT,
    key_achievements TEXT[],   -- bullet points used in CVs
    skills_demonstrated TEXT[],
    tools_used TEXT[],
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    tailoring_weight REAL DEFAULT 1.0,  -- how often this is selected for tailored CVs (learned)
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Education
CREATE TABLE IF NOT EXISTS education_history_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree TEXT,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    grade TEXT,
    highlights TEXT[],
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (for portfolio/CV)
CREATE TABLE IF NOT EXISTS portfolio_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    description TEXT,
    url TEXT,
    github_url TEXT,
    skills_used TEXT[],
    highlights TEXT[],
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- JOB-SPECIFIC NOTES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS application_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    note_title TEXT NOT NULL DEFAULT 'Untitled Note',
    note_body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GMAIL OAUTH (for post-application tracking)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_gmail_credentials (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    email_address TEXT,
    watch_enabled BOOLEAN DEFAULT FALSE,
    watch_expiry TIMESTAMPTZ,
    last_history_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DATABASE HEALTH MATERIALIZED VIEW
-- ═══════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS ga_job_stats AS
SELECT
    source,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE is_active = true) AS active,
    COUNT(*) FILTER (WHERE status = 'expired') AS expired,
    MAX(last_seen_at) AS last_seen,
    MAX(created_at) AS newest_job
FROM jobs
GROUP BY source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ga_job_stats_source ON ga_job_stats(source);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tracked_app_user ON tracked_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_app_job ON tracked_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_tracked_app_stage ON tracked_applications(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_tracked_app_user_stage ON tracked_applications(user_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_tracked_app_starred ON tracked_applications(user_id) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_stage_log_app ON application_stage_log(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_app ON interview_rounds(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled ON interview_rounds(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interviews_upcoming ON interview_rounds(user_id, scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_emails_app ON application_emails(application_id);
CREATE INDEX IF NOT EXISTS idx_app_emails_gmail ON application_emails(user_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_app_emails_category ON application_emails(email_category);
CREATE INDEX IF NOT EXISTS idx_work_history_user ON work_history_items(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_app_notes_job ON application_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score_ai) WHERE match_score_ai IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_visa_score ON jobs(visa_sponsor_score) WHERE visa_sponsor_score IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ga_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tracked_app_updated ON tracked_applications;
CREATE TRIGGER trg_tracked_app_updated BEFORE UPDATE ON tracked_applications FOR EACH ROW EXECUTE FUNCTION ga_set_updated_at();
DROP TRIGGER IF EXISTS trg_interviews_updated ON interview_rounds;
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON interview_rounds FOR EACH ROW EXECUTE FUNCTION ga_set_updated_at();
DROP TRIGGER IF EXISTS trg_user_profile_updated ON user_job_profiles;
CREATE TRIGGER trg_user_profile_updated BEFORE UPDATE ON user_job_profiles FOR EACH ROW EXECUTE FUNCTION ga_set_updated_at();
DROP TRIGGER IF EXISTS trg_work_history_updated ON work_history_items;
CREATE TRIGGER trg_work_history_updated BEFORE UPDATE ON work_history_items FOR EACH ROW EXECUTE FUNCTION ga_set_updated_at();
DROP TRIGGER IF EXISTS trg_app_notes_updated ON application_notes;
CREATE TRIGGER trg_app_notes_updated BEFORE UPDATE ON application_notes FOR EACH ROW EXECUTE FUNCTION ga_set_updated_at();
