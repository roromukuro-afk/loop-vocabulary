-- Issue #80: 通知設定列を追加する。既存の006_notify_settings.sqlは本番へ
-- 未適用のまま履歴資料として残し、直接編集しない(本番migration履歴との
-- 不整合をさらに分かりにくくしないため)。
--
-- 006とは異なり、初期値をfalseにする: 既存006のDEFAULT trueをそのまま
-- 適用すると、明示的にONへ変更した記憶のない既存ユーザー全員が週次メール
-- の配信対象になり得るため。週次メール・プッシュ通知とも、ユーザーが
-- 明示的にONへ変更した場合にのみ対象とする。
--
-- 既存のprofiles RLS・policyは変更しない(新policyも追加しない)。
alter table public.profiles
  add column if not exists notify_weekly_email boolean not null default false,
  add column if not exists notify_push_enabled boolean not null default false;

alter table public.profiles
  alter column notify_weekly_email set default false,
  alter column notify_push_enabled set default false;
