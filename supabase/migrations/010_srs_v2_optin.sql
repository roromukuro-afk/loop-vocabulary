-- ============================================================
-- 010_srs_v2_optin.sql
-- SRS V2（動的間隔）をユーザー個別に有効化する opt-in フラグ
-- ------------------------------------------------------------
-- ・追加のみ（既存カラム・既存データ・RLS は一切変更しない）
-- ・既定 false = 全ユーザーは従来の V1（固定間隔）のまま
-- ・アプリ側は「グローバル env フラグ NEXT_PUBLIC_SRS_V2=1」または
--   「この profiles.srs_v2 = true」のいずれかで V2 を使う。
--   段階導入（自分/テストアカウント限定→全体）に用いる。
-- ============================================================

alter table public.profiles
  add column if not exists srs_v2 boolean not null default false;

comment on column public.profiles.srs_v2 is
  'SRS V2(動的間隔)を個別に有効化する opt-in フラグ。既定 false。env NEXT_PUBLIC_SRS_V2=1 で全体ONも可能。';
