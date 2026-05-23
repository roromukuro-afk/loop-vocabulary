-- ============================================================
-- Loop Vocabulary - Row Level Security
-- ============================================================
-- ルール:
--   - ユーザーは自分のデータだけ読み書きできる
--   - 公開教材データは全ユーザーが閲覧可
--   - 教材データの作成・編集・非公開化は管理者のみ
--   - 許諾済み (license_status='approved' かつ is_public=true) のみユーザー画面に表示
-- ============================================================

-- 管理者判定ヘルパー
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============== profiles ==============
alter table public.profiles enable row level security;
drop policy if exists "profiles self select" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin all"   on public.profiles;
create policy "profiles self select" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles admin all"   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ============== licenses (管理者のみ) ==============
alter table public.licenses enable row level security;
drop policy if exists "licenses admin all" on public.licenses;
create policy "licenses admin all" on public.licenses for all using (public.is_admin()) with check (public.is_admin());

-- ============== materials ==============
alter table public.materials enable row level security;
drop policy if exists "materials public read" on public.materials;
drop policy if exists "materials admin all"   on public.materials;
create policy "materials public read" on public.materials
  for select using (is_public = true and license_status = 'approved');
create policy "materials admin all" on public.materials
  for all using (public.is_admin()) with check (public.is_admin());

-- ============== material_units ==============
alter table public.material_units enable row level security;
drop policy if exists "material_units public read" on public.material_units;
drop policy if exists "material_units admin all"   on public.material_units;
create policy "material_units public read" on public.material_units
  for select using (
    exists (
      select 1 from public.materials m
      where m.id = material_units.material_id
        and m.is_public = true
        and m.license_status = 'approved'
    )
  );
create policy "material_units admin all" on public.material_units
  for all using (public.is_admin()) with check (public.is_admin());

-- ============== material_words ==============
alter table public.material_words enable row level security;
drop policy if exists "material_words public read" on public.material_words;
drop policy if exists "material_words admin all"   on public.material_words;
create policy "material_words public read" on public.material_words
  for select using (
    exists (
      select 1 from public.materials m
      where m.id = material_words.material_id
        and m.is_public = true
        and m.license_status = 'approved'
    )
  );
create policy "material_words admin all" on public.material_words
  for all using (public.is_admin()) with check (public.is_admin());

-- ============== word_books ==============
alter table public.word_books enable row level security;
drop policy if exists "word_books owner all" on public.word_books;
create policy "word_books owner all" on public.word_books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== words ==============
alter table public.words enable row level security;
drop policy if exists "words owner all" on public.words;
create policy "words owner all" on public.words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== study_sessions ==============
alter table public.study_sessions enable row level security;
drop policy if exists "sessions owner all" on public.study_sessions;
create policy "sessions owner all" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== study_results ==============
alter table public.study_results enable row level security;
drop policy if exists "results owner all" on public.study_results;
create policy "results owner all" on public.study_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== daily_stats ==============
alter table public.daily_stats enable row level security;
drop policy if exists "daily owner all" on public.daily_stats;
create policy "daily owner all" on public.daily_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== ai_usage_logs ==============
alter table public.ai_usage_logs enable row level security;
drop policy if exists "ai_usage owner all" on public.ai_usage_logs;
create policy "ai_usage owner all" on public.ai_usage_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== reward_tickets ==============
alter table public.reward_tickets enable row level security;
drop policy if exists "tickets owner all" on public.reward_tickets;
create policy "tickets owner all" on public.reward_tickets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== pdf_exports ==============
alter table public.pdf_exports enable row level security;
drop policy if exists "pdf owner all" on public.pdf_exports;
create policy "pdf owner all" on public.pdf_exports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== test_templates ==============
alter table public.test_templates enable row level security;
drop policy if exists "templates owner all" on public.test_templates;
create policy "templates owner all" on public.test_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============== account_deletion_requests ==============
alter table public.account_deletion_requests enable row level security;
drop policy if exists "adr self select"  on public.account_deletion_requests;
drop policy if exists "adr self insert"  on public.account_deletion_requests;
drop policy if exists "adr admin all"    on public.account_deletion_requests;
create policy "adr self select" on public.account_deletion_requests
  for select using (auth.uid() = user_id);
create policy "adr self insert" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
create policy "adr admin all" on public.account_deletion_requests
  for all using (public.is_admin()) with check (public.is_admin());
