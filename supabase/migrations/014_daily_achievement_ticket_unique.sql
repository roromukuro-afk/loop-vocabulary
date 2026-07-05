-- ============================================================
-- 014_daily_achievement_ticket_unique.sql
-- daily_achievement チケットの二重付与防止をDB側で完全化
-- ------------------------------------------------------------
-- ・reward_tickets に新しい列は追加しない（既存スキーマ・既存RLSは無変更）
-- ・kind = 'daily_achievement' の行だけを対象にした部分ユニークインデックスを追加し、
--   同一ユーザー×同一JST日での複数付与をDB側で物理的に禁止する
--   （API側のcheck-then-insertだけでは埋められない同時リクエストの競合窓を塞ぐ）
-- ・JST日付は (granted_at at time zone interval '9:00:00')::date で算出する。
--   固定オフセット+9時間での変換であり、src/lib/utils/date.ts の JST_OFFSET_MS 固定オフセット
--   計算と同じ基準（DSTなしの+9時間）で日付境界を揃えている。
--   実装時に判明した注意点（Postgresのインデックス式はIMMUTABLE関数のみ許可されるため）:
--     - `granted_at at time zone 'Asia/Tokyo'`（named timezone）はタイムゾーンDBに依存し
--       STABLE関数扱いとなるため、インデックス式には使えない（42P17エラー）
--     - `granted_at + interval '9 hours'` は timestamptz のままなので、その後の `::date` キャストが
--       セッションのTimeZone設定に依存するSTABLEな変換になり、これも使えない（同じく42P17）
--     - `at time zone interval '...'`（固定intervalでのタイムゾーン変換）は timestamp（tzなし）を
--       返し、これはセッション設定に依存しないIMMUTABLEな変換のため、インデックス式に利用できる
-- ・WHERE kind = 'daily_achievement' の部分インデックスなので、
--   ai_generation / extra_review 等ほかの kind の行の付与・消費には一切影響しない
-- ・適用前に本番データを調査済み: daily_achievement は現在1件のみで重複なし、
--   ほかに存在する kind は extra_review のみ（重複データの削除・移行は不要）
-- ============================================================

create unique index if not exists reward_tickets_daily_achievement_one_per_jst_day
  on public.reward_tickets (user_id, ((granted_at at time zone interval '9:00:00')::date))
  where kind = 'daily_achievement';
