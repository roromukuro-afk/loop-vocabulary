ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_weekly_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push_enabled boolean NOT NULL DEFAULT true;
