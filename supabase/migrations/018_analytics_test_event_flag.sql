-- Growth OS: analytics_events にテストトラフィック識別用フラグを追加する。
--
-- 背景: is_test_account はログイン済みユーザーのテストアカウントしか区別できず、
-- 匿名イベント(anonymous_session_id のみ)には適用できなかった。E2Eテストハーネスが
-- 送信専用ヘッダー(x-lv-e2e-test)を付与した場合、取り込みAPI(src/app/api/analytics/events/route.ts)
-- がこの列に true を書き込む。既存の実データは変更しない(全行 false のまま)。
-- 今後の集計(src/lib/analytics/rollup.ts)はこの列が true の行を除外する。

alter table analytics_events
  add column if not exists is_test_event boolean not null default false;

comment on column analytics_events.is_test_event is
  'E2Eテストハーネスからの送信と判定されたイベント。集計(rollup)からは除外する。';
