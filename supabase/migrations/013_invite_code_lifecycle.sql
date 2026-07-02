-- ============================================================
-- 013_invite_code_lifecycle.sql
-- teacher機能: 招待コードの失効・再発行・使用停止・期限管理
-- ------------------------------------------------------------
-- ・classes に3列追加のみ（既存カラム・既存データ・既存RLSは一切変更しない）
-- ・追加列はすべて nullable（invite_code_updated_at のみ default now() で埋める）
--   のため、既存クラスの招待コードは「無期限・有効」のまま従来通り動作し続ける
-- ・lookup_class_by_code は列追加(status)のため DROP + CREATE で再作成が必要
--   （PostgreSQLは CREATE OR REPLACE FUNCTION で RETURNS TABLE の列構成を変更できない）
-- ============================================================

alter table public.classes
  add column if not exists invite_code_expires_at timestamptz,
  add column if not exists invite_code_revoked_at  timestamptz,
  add column if not exists invite_code_updated_at  timestamptz not null default now();

comment on column public.classes.invite_code_expires_at is '招待コードの有効期限。nullは無期限（既存クラスの既定値）';
comment on column public.classes.invite_code_revoked_at  is '招待コードが無効化された日時。nullは有効';
comment on column public.classes.invite_code_updated_at  is '招待コードが最後に発行/更新された日時';

drop function if exists public.lookup_class_by_code(text);

-- 招待コードからクラスの最小情報を返す（参加画面用）。
-- 失効/期限切れの判定を status として返し、参加画面が理由別のメッセージを出せるようにする。
-- archived=false の絞り込みは既存挙動のまま（archivedなクラスはそもそも一致しない＝'not found'扱い）。
create function public.lookup_class_by_code(p_code text)
returns table (class_id uuid, class_name text, teacher_name text, status text)
language sql security definer set search_path = public as $$
  select c.id, c.name, coalesce(p.display_name, '先生'),
    case
      when c.invite_code_revoked_at is not null then 'revoked'
      when c.invite_code_expires_at is not null and c.invite_code_expires_at <= now() then 'expired'
      else 'ok'
    end
  from public.classes c
  left join public.profiles p on p.id = c.teacher_id
  where c.invite_code = p_code and c.archived = false
  limit 1;
$$;

revoke all on function public.lookup_class_by_code(text) from public, anon;
grant execute on function public.lookup_class_by_code(text) to authenticated;

-- RLS変更なし: 招待コードの更新(再発行/無効化)は既存の
-- "classes teacher all" ポリシー(teacher_id = auth.uid())がそのまま保護する。
