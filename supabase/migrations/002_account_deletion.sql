-- ============================================================
-- Migration 002: アカウント削除リクエスト
-- ------------------------------------------------------------
-- Apple App Store / Google Play で必須化されている
-- 「アプリ内からのアカウント削除導線」を満たすため、
-- 削除リクエストを記録するテーブルを追加。
--
-- 物理削除 (auth.users / profiles の DELETE) は本ファイルでは
-- 行わず、管理者が手動 or 別ジョブで処理する設計。
-- ============================================================

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  admin_note text
);

create index if not exists adr_user_idx
  on public.account_deletion_requests(user_id);
create index if not exists adr_status_idx
  on public.account_deletion_requests(status);

-- 1 ユーザー = 1 pending を保証 (重複作成防止)
create unique index if not exists adr_one_pending_per_user
  on public.account_deletion_requests(user_id)
  where status = 'pending';

-- ============== RLS ==============
alter table public.account_deletion_requests enable row level security;

-- ユーザー本人: 自分のリクエストだけ select / insert 可
drop policy if exists "adr self select" on public.account_deletion_requests;
create policy "adr self select" on public.account_deletion_requests
  for select using (auth.uid() = user_id);

drop policy if exists "adr self insert" on public.account_deletion_requests;
create policy "adr self insert" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);

-- 管理者: 全件 select / update / delete
drop policy if exists "adr admin all" on public.account_deletion_requests;
create policy "adr admin all" on public.account_deletion_requests
  for all using (public.is_admin()) with check (public.is_admin());
