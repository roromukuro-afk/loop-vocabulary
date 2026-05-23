-- ============================================================
-- Loop Vocabulary - Database Schema
-- ============================================================
-- 実行順:
--   1) schema.sql  (この本ファイル: テーブル定義)
--   2) rls.sql     (Row Level Security)
--   3) seed.sql    (初期データ)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============== ユーザープロフィール ==============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  is_premium boolean not null default false,
  daily_ai_used integer not null default 0,
  daily_ai_reset_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 新規ユーザー登録時に profiles を自動作成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== 教材・参考書 (公開データ) ==============
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'pending', -- pending / approved / denied
  source_url text,
  note text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  author text,
  description text,
  level text,         -- 中学基礎 / 高校基礎 / 大学受験基礎 ...
  exam_type text,     -- 高校入試 / 大学受験 / 英検 / TOEIC など
  source_url text,
  license_id uuid references public.licenses(id) on delete set null,
  license_status text not null default 'pending',
  license_note text,
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists materials_public_idx on public.materials(is_public);
create index if not exists materials_exam_idx   on public.materials(exam_type);
create index if not exists materials_level_idx  on public.materials(level);

create table if not exists public.material_units (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  chapter text,
  unit text,
  page text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists material_units_material_idx on public.material_units(material_id);

create table if not exists public.material_words (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  unit_id uuid references public.material_units(id) on delete set null,
  word text not null,
  meaning text not null,
  pos text,
  example text,
  example_ja text,
  importance integer not null default 3, -- 1..5
  frequency integer not null default 3,
  level text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists material_words_material_idx on public.material_words(material_id);
create index if not exists material_words_word_idx     on public.material_words(word);

-- ============== ユーザー単語帳 ==============
create table if not exists public.word_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  level text,        -- 中学基礎 / 高校基礎 / 大学受験 ...
  exam_type text,    -- 英検3級 / TOEIC など
  source_type text not null default 'custom', -- custom / material / system
  source_material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists word_books_user_idx on public.word_books(user_id);

-- ============== ユーザー単語 ==============
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_book_id uuid references public.word_books(id) on delete set null,
  word text not null,
  meaning text not null,
  pos text,
  phonetic text,
  example text,
  example_ja text,
  etymology text,
  nuance text,
  similar text,
  antonym text,
  derivative text,
  idiom text,
  tags text[] not null default '{}',
  importance integer not null default 3, -- 1..5
  mastery integer not null default 0,    -- 0..100
  last_studied_at timestamptz,
  next_review_at timestamptz,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  streak integer not null default 0,
  is_weak boolean not null default false,
  material_id uuid references public.materials(id) on delete set null,
  source_id text,
  license_status text not null default 'self',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists words_user_idx        on public.words(user_id);
create index if not exists words_book_idx        on public.words(word_book_id);
create index if not exists words_next_review_idx on public.words(user_id, next_review_at);
create index if not exists words_weak_idx        on public.words(user_id, is_weak);

-- ============== 学習履歴 ==============
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,  -- choice / input / review
  total integer not null default 0,
  correct integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists sessions_user_idx on public.study_sessions(user_id, started_at desc);

create table if not exists public.study_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);
create index if not exists results_user_idx on public.study_results(user_id, answered_at desc);

-- ============== 日次集計 ==============
create table if not exists public.daily_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  studied_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  primary key (user_id, day)
);

-- ============== AI 利用ログ ==============
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- example / explain / etymology / mnemonic
  prompt text,
  result text,
  used_at timestamptz not null default now()
);

-- ============== リワードチケット (広告視聴で付与) ==============
create table if not exists public.reward_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- ai / pdf / review / weak_test
  amount integer not null default 1,
  used_amount integer not null default 0,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ============== PDF 出力ログ ==============
create table if not exists public.pdf_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_book_id uuid references public.word_books(id) on delete set null,
  material_id uuid references public.materials(id) on delete set null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

-- ============== 小テストテンプレート ==============
create table if not exists public.test_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ begin
  perform 1; -- create triggers idempotently
exception when others then null;
end $$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_materials on public.materials;
create trigger trg_touch_materials before update on public.materials
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_word_books on public.word_books;
create trigger trg_touch_word_books before update on public.word_books
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_words on public.words;
create trigger trg_touch_words before update on public.words
  for each row execute function public.touch_updated_at();
