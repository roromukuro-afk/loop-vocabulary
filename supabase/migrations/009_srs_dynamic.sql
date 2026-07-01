-- ============================================================
-- 009_srs_dynamic.sql
-- SRS V2（動的間隔 / 自己評価ベース）用の追加カラム
-- ------------------------------------------------------------
-- ・追加のみ（既存カラム・既存データ・RLS は一切変更しない）
-- ・既存行は DEFAULT で自動的に埋まる（バックフィル不要）
-- ・アプリ側は feature flag NEXT_PUBLIC_SRS_V2=1 が ON のときだけ
--   これらのカラムを参照/更新する。OFF（既定）なら未使用で、
--   復習スケジュールは従来の固定間隔 V1 のまま完全に同一挙動。
-- ============================================================

alter table public.words
  add column if not exists ease_factor  real not null default 2.5,  -- 難易度係数 (1.3〜2.8)
  add column if not exists interval_days real not null default 0;    -- 直近の復習間隔（日）, 0 = 初回

comment on column public.words.ease_factor  is 'SRS V2: 難易度係数 (1.3-2.8, default 2.5)。V2フラグOFF時は未使用。';
comment on column public.words.interval_days is 'SRS V2: 直近の復習間隔（日）。0=初回。V2フラグOFF時は未使用。';

-- RLS 変更なし。words の既存ポリシー（owner のみ）をそのまま継承する。
