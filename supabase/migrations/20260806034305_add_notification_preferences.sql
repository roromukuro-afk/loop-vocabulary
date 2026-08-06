-- Issue #80:
-- 通知設定列を明示的なopt-inとして追加する。
--
-- 旧006_notify_settings.sqlが適用済みの環境では、
-- 既存ユーザーがDEFAULT trueによって自動的にopt-in扱いに
-- なっている可能性がある。
--
-- しかし、既存のtrue値が旧default由来か、
-- ユーザーが実際に選択した値かはDB上から判別できない。
-- そのため既存値を一括UPDATEせず、列が既に存在し、かつ
-- profilesに1行以上の実データがある環境ではmigrationを
-- 中断して個別監査を要求する(fail-closed)。
--
-- 一方、profilesが0行(真にフレッシュな環境。例: CI・
-- supabase db reset・新規Supabaseプロジェクトの立ち上げ等で
-- 006がこのmigrationより先に実行され、まだ1ユーザーも
-- 存在しない場合)は、実データが無いためUPDATEは一切
-- 発生せず、値を破壊するリスクが無い。この場合のみ、
-- 列定義(今後追加されるユーザーのデフォルト値)をfalseへ
-- 揃えることを許可する。
do $$
declare
  columns_exist boolean;
  has_existing_rows boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in (
        'notify_weekly_email',
        'notify_push_enabled'
      )
  ) into columns_exist;

  if not columns_exist then
    execute
      'alter table public.profiles '
      'add column notify_weekly_email boolean not null default false, '
      'add column notify_push_enabled boolean not null default false';
    return;
  end if;

  select exists (select 1 from public.profiles limit 1) into has_existing_rows;

  if has_existing_rows then
    raise exception using
      errcode = '55000',
      message =
        'notification preference columns already exist with data; '
        'audit legacy values before applying this migration';
  end if;

  -- 列は既に存在するがprofilesは0行(データ破壊リスク無し)。
  -- 列定義のdefaultだけをfalseへ揃える。対象行が無いため
  -- 既存値のUPDATEは発生しない。
  execute
    'alter table public.profiles '
    'alter column notify_weekly_email set default false, '
    'alter column notify_push_enabled set default false';
end
$$;
