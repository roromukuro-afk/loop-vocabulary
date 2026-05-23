-- ============================================================
-- Loop Vocabulary - RLS 動作確認スクリプト
-- ============================================================
-- 本番投入前に、Supabase SQL Editor で順番に実行してください。
-- 各クエリの「期待結果」と一致しているかを必ず確認。
--
-- 注意: SQL Editor はデフォルトで postgres ロール (RLS バイパス) で
--   実行されるため、`set role authenticated;` / `set role anon;`
--   で実ロールを擬似する必要があります。
-- ============================================================

-- ============================================================
-- 1. RLS が全テーブルで有効化されているか
-- ============================================================
-- 期待結果: 14 テーブル全てが rowsecurity = true
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- ============================================================
-- 2. 匿名ユーザー (anon) には公開教材だけが見えるか
-- ============================================================
-- 期待結果:
--   - public_materials_count > 0 (シード済の Loop 基本英単語 30 が見える)
--   - other_users_words_count = 0 (他人の words は見えない)
--   - other_users_books_count = 0 (他人の word_books は見えない)
begin;
set role anon;

select
  (select count(*) from public.materials
     where is_public = true and license_status = 'approved') as public_materials_count,
  (select count(*) from public.material_words) as public_material_words_count,
  (select count(*) from public.words)         as other_users_words_count,
  (select count(*) from public.word_books)    as other_users_books_count,
  (select count(*) from public.daily_stats)   as other_users_daily_count,
  (select count(*) from public.profiles)      as other_users_profiles_count;

rollback;

-- ============================================================
-- 3. 認証済みユーザー (authenticated) には自分のデータだけが見えるか
-- ============================================================
-- ※ <USER_UUID> を実ユーザーの uuid に置換して実行
-- 期待結果: そのユーザーの words / word_books だけが返る
/*
begin;
set local "request.jwt.claim.sub" = '<USER_UUID>';
set local role authenticated;

select count(*) as my_words      from public.words;
select count(*) as my_word_books from public.word_books;
select count(*) as my_daily      from public.daily_stats;

rollback;
*/

-- ============================================================
-- 4. 管理者でないユーザーが教材を INSERT できないか
-- ============================================================
-- ※ <USER_UUID> = is_admin = false のユーザーの UUID で実行
-- 期待結果: ERROR new row violates row-level security policy
/*
begin;
set local "request.jwt.claim.sub" = '<NON_ADMIN_USER_UUID>';
set local role authenticated;

insert into public.materials (title, license_status, is_public)
values ('不正な追加テスト', 'approved', true);

rollback;
*/

-- ============================================================
-- 5. 非公開教材 (license_status='pending') が anon から見えないか
-- ============================================================
-- セットアップ: 管理者で 1 件 pending を作成
/*
insert into public.materials (title, license_status, is_public, created_by)
values ('Pending Test Material', 'pending', true, auth.uid());
*/

-- anon から見たカウント
-- 期待結果: pending_visible = 0
begin;
set role anon;

select count(*) as pending_visible
from public.materials
where license_status = 'pending';

rollback;

-- ============================================================
-- 6. 管理者化 (本番運用での管理者作成)
-- ============================================================
-- 自分のアカウントを管理者に昇格
-- 期待結果: 1 行 update
/*
update public.profiles
set is_admin = true
where email = 'admin@example.com';

select id, email, is_admin from public.profiles where is_admin = true;
*/

-- ============================================================
-- 7. on_auth_user_created トリガが動いているか
-- ============================================================
-- 期待結果: 1 行
select tgname, tgenabled
from pg_trigger
where tgname = 'on_auth_user_created';

-- auth.users と profiles の件数比較
-- 期待結果: 同数 (signup したのに profile が作られていないユーザーがいないか)
select
  (select count(*) from auth.users)       as auth_users_count,
  (select count(*) from public.profiles)  as profiles_count;
