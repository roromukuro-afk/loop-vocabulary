-- Issue #80:
-- 通知設定列を明示的なopt-inとして追加する。
--
-- 旧006_notify_settings.sqlが適用済みの環境では、
-- 既存ユーザーがDEFAULT trueによって自動的にopt-in扱いに
-- なっている可能性がある。
--
-- しかし、既存のtrue値が旧default由来か、
-- ユーザーが実際に選択した値かはDB上から判別できない。
-- そのため既存値を一括UPDATEせず、列が既に存在する環境では
-- migrationを中断して個別監査を要求する。

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in (
        'notify_weekly_email',
        'notify_push_enabled'
      )
  ) then
    raise exception using
      errcode = '55000',
      message =
        'notification preference columns already exist; '
        'audit legacy values before applying this migration';
  end if;
end
$$;

alter table public.profiles
  add column notify_weekly_email
    boolean not null default false,
  add column notify_push_enabled
    boolean not null default false;
