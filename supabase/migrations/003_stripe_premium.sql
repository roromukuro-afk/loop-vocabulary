-- Stripe連携 + プレミアム管理カラム追加
-- Supabase Studio > SQL Editor で実行

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS premium_expires_at  timestamptz;

CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON public.profiles(stripe_customer_id);
