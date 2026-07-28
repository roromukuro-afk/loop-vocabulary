-- 修正: `GET DIAGNOSTICS v_inserted = ROW_COUNT` はROW_COUNTが整数型であるため、
-- v_inserted が boolean 型のままだと「operator does not exist: boolean > integer」
-- (42883)エラーになる。026番でこの不具合が残っており、本番稼働前のデプロイ前検証
-- (test-insert-once-per-user-milestone-event.mjsでの実RPC呼び出しテスト)で
-- 発見・修正した。本番でエラーが発生したことはない。
--
-- 適用日時: 2026-07-28 14:27:15 UTC
-- 対象Supabase project ref: befjjebsrnsfwhtmydiv (loop-vocabulary)
-- 適用方法: Supabase MCP `apply_migration`
--           (name: fix_insert_once_per_user_milestone_event_type_mismatch)
-- 適用状態: 本番へ適用済み。2026-07-29時点で
--           `pg_get_functiondef(oid) from pg_proc where proname = 'insert_once_per_user_milestone_event'`
--           により本番の実体がこのファイルの内容と完全一致することを確認済み。
--           このマイグレーションが現在の最終・正しい状態であり、これ以降の変更はない。
--           再適用は不要(CREATE OR REPLACE FUNCTIONのためno-op)。
--
-- 変更点:
--   v_inserted boolean を v_row_count integer に変更し、
--   RETURN v_inserted; を RETURN v_row_count > 0; に変更。ロジックは変わらない。
--
-- 関数の権限(2026-07-29時点で本番から直接確認):
--   information_schema.routine_privileges で EXECUTE を持つのは
--   service_role と postgres(テーブル所有者)のみ。PUBLIC/anon/authenticatedには
--   EXECUTE権限がない(REVOKE済み)。
--
-- RLSへの影響:
--   SECURITY DEFINER関数のため、呼び出し元のRLSに関わらず関数所有者の権限で
--   実行される。analytics_events自体のRLS(admin-selectポリシーのみ、
--   017_growth_os_foundation.sql参照)は本マイグレーションで変更していない。
--   INSERT/UPDATE/DELETEはservice-role経由のみという既存方針を踏襲している。
--
-- 検証クエリ(いつでも再実行可能。0件が期待値):
--   select event_name, user_id, count(*) from analytics_events
--   where event_name in ('return_next_day','return_day_7') and user_id is not null
--   group by event_name, user_id having count(*) > 1;
--
-- 再適用時の扱い:
--   024〜027番はいずれも IF NOT EXISTS / CREATE OR REPLACE を使用しているため、
--   誤ってもう一度適用されても安全にno-opとなる。ただし本番へは適用済みのため、
--   Supabase MCPのapply_migration等で意図的に再実行する必要はない
--   (supabase_migrations.schema_migrationsに既にversion 20260728142230〜
--   20260728142715として記録済み)。
--
-- rollback(024〜027番すべてをまとめて取り消す場合):
--   DROP FUNCTION IF EXISTS public.insert_once_per_user_milestone_event(text, uuid, jsonb);
--   DROP INDEX IF EXISTS analytics_events_once_per_user_milestone_uniq;
--   注意: rollback後は src/lib/analytics/rollup.ts の computeReturnEvents() が
--   参照しているRPCが存在しなくなるため、rollbackする場合はアプリコード側
--   (insertOncePerUserMilestoneEvent、computeReturnEvents)も同時に
--   旧実装へ戻すか、機能を無効化する必要がある。

CREATE OR REPLACE FUNCTION public.insert_once_per_user_milestone_event(
  p_event_name text,
  p_user_id uuid,
  p_properties jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count integer;
BEGIN
  IF p_event_name NOT IN ('return_next_day', 'return_day_7') THEN
    RAISE EXCEPTION 'insert_once_per_user_milestone_event: unsupported event_name %', p_event_name;
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'insert_once_per_user_milestone_event: p_user_id must not be null';
  END IF;

  INSERT INTO public.analytics_events (
    event_name, occurred_at, user_id, properties, schema_version, device_category
  )
  VALUES (
    p_event_name, now(), p_user_id, p_properties, 1, 'unknown'
  )
  ON CONFLICT (event_name, user_id) WHERE event_name IN ('return_next_day', 'return_day_7') AND user_id IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_once_per_user_milestone_event(text, uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.insert_once_per_user_milestone_event(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
