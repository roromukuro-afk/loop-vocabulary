-- ============================================================
-- 012_test_account_flag.sql
-- 自動検証用テストアカウントを識別するためのフラグ（追加のみ）
-- ------------------------------------------------------------
-- ・既存カラム・既存データ・既存RLSは変更しない
-- ・既定 false。テストユーザー作成スクリプトが true をセットする
-- ============================================================

alter table public.profiles
  add column if not exists is_test_account boolean not null default false;

comment on column public.profiles.is_test_account is
  '自動E2E検証用のテストアカウントである場合 true。実ユーザーには常に false。';
