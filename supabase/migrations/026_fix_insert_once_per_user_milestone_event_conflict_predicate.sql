-- 修正: ON CONFLICT の述語が、部分ユニークインデックス(024番)のWHERE句と
-- 完全一致していないと、PostgresがそのインデックスをON CONFLICTのターゲットとして
-- 推論できない。025番の初版は "AND user_id IS NOT NULL" を含んでおらず、
-- 「there is no unique or exclusion constraint matching the ON CONFLICT
-- specification」(42P10)エラーで失敗した。この不具合は本番稼働前の
-- デプロイ前検証(scripts/testing/test-insert-once-per-user-milestone-event.mjs
-- での実RPC呼び出しテスト)で発見・修正しており、本番でエラーが発生したことはない。
--
-- 適用日時: 2026-07-28 14:26:33 UTC
-- 対象Supabase project ref: befjjebsrnsfwhtmydiv (loop-vocabulary)
-- 適用方法: Supabase MCP `apply_migration`
--           (name: fix_insert_once_per_user_milestone_event_conflict_predicate)
-- 適用状態: 本番へ適用済み。ただしこの関数定義も直後の027番マイグレーションで
--           型エラー修正が入っており、現在の本番の実体は027番の内容。
--           このファイルは履歴として残すが、再適用は不要
--           (CREATE OR REPLACE FUNCTIONのため実行しても027番の内容で上書きされる)。
--
-- 変更点:
--   ・ON CONFLICT述語に "AND user_id IS NOT NULL" を追加し、024番インデックスの
--     WHERE句と完全一致させた
--   ・p_user_id が NULL の場合に例外を送出するガードを追加(部分インデックスの
--     対象外になってしまい、dedupが効かない状態でのinsertを未然に防ぐ)
--   ・service_role への GRANT EXECUTE を明示的に追加(025番ではREVOKEのみで、
--     service_roleへの明示的なGRANTがなかった点も合わせて是正)
--
-- rollback:
--   025番マイグレーションの関数定義に戻す(ただし025番自体が既知の不具合を
--   含むため、実運用上は027番からのrollbackのみを想定する)。

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
  v_inserted boolean;
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

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_once_per_user_milestone_event(text, uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.insert_once_per_user_milestone_event(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
