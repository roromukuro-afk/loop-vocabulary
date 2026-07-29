-- return_next_day / return_day_7 用の、race-safeなatomic insert関数。
--
-- 適用日時: 2026-07-28 14:25:52 UTC
-- 対象Supabase project ref: befjjebsrnsfwhtmydiv (loop-vocabulary)
-- 適用方法: Supabase MCP `apply_migration`(name: add_insert_once_per_user_milestone_event_function)
-- 適用状態: 本番へ適用済み。ただしこのバージョンの関数定義は、直後の
--           026・027番マイグレーションで2回修正されており、現在の本番の実体は
--           027番の内容である。このファイルは履歴として残すが、再適用は不要
--           (CREATE OR REPLACE FUNCTIONのため実行しても027番の内容で上書きされ、
--           実害はない)。
--
-- 変更理由:
--   024番の部分ユニークインデックスを使ってatomicにinsertするための専用関数。
--   PostgRESTの upsert() は部分インデックスのWHERE述語をON CONFLICT推論の対象に
--   できないため、専用のPL/pgSQL関数が必要だった。挿入が成功したかどうか(新規行か、
--   既存重複によるno-opか)を戻り値で明示し、呼び出し側が「本当に失敗したのか」
--   「単に重複だったのか」を区別できるようにする。
--
-- 関数の権限:
--   SECURITY DEFINER。PostgRESTの公開API経由では呼び出せないよう、
--   PUBLIC/anon/authenticatedからEXECUTE権限をREVOKEしている
--   (service_roleへのGRANTは027番マイグレーションで明示的に追加)。
--   サーバーサイドのservice-role adminクライアント経由でのみ呼び出される想定。
--
-- RLSへの影響:
--   SECURITY DEFINER関数のため、呼び出し元のRLSに関わらず関数所有者の権限で実行される。
--   analytics_eventsのRLSポリシー自体は変更しない。
--
-- rollback:
--   DROP FUNCTION IF EXISTS public.insert_once_per_user_milestone_event(text, uuid, jsonb);

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

  INSERT INTO public.analytics_events (
    event_name, occurred_at, user_id, properties, schema_version, device_category
  )
  VALUES (
    p_event_name, now(), p_user_id, p_properties, 1, 'unknown'
  )
  ON CONFLICT (event_name, user_id) WHERE event_name IN ('return_next_day', 'return_day_7')
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

-- Not exposed via PostgREST's public API (no anon/authenticated grant) — this
-- function is only ever called from server-side code using the service-role
-- admin client, matching how trackServerEvent.ts already operates.
REVOKE EXECUTE ON FUNCTION public.insert_once_per_user_milestone_event(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
