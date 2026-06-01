-- Calendar events and notification tables for GetAutoApply

-- Calendar events (interviews, follow-ups, deadlines)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'interview' CHECK (event_type IN ('interview', 'follow_up', 'deadline', 'networking', 'other')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  reminder_minutes INTEGER DEFAULT 15,
  notes TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_user_time ON public.calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_job ON public.calendar_events(job_id);
CREATE INDEX IF NOT EXISTS idx_calendar_app ON public.calendar_events(application_id);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  job_alerts BOOLEAN DEFAULT true,
  application_updates BOOLEAN DEFAULT true,
  interview_reminders BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  email_frequency TEXT DEFAULT 'daily' CHECK (email_frequency IN ('realtime', 'daily', 'weekly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Job alerts (saved searches that trigger notifications)
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  location TEXT,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('realtime', 'daily', 'weekly')),
  sources JSONB DEFAULT '["indeed", "linkedin"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON public.job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON public.job_alerts(is_active);

-- Notification log (sent notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('job_alert', 'application_update', 'interview_reminder', 'weekly_digest', 'system')),
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, sent_at);

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar" ON public.calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notif prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own job alerts" ON public.job_alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Trigger: create default notification prefs on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_notif()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_created_notif ON auth.users;
CREATE TRIGGER on_user_created_notif
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_notif();
