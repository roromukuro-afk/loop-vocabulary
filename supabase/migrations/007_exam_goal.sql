-- 試験目標・試験日をプロフィールに追加
-- Supabase Studio > SQL Editor で実行

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exam_goal text,
  ADD COLUMN IF NOT EXISTS exam_date date;
