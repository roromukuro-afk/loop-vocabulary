-- ============================================================
-- 016_ai_usage_events.sql
-- AI route別の軽量利用ログ（2026-07-06、AI利用状況の運用監視ラウンド）
-- ------------------------------------------------------------
-- 目的: /admin/ai は現状 profiles.daily_ai_used（本日分の合計のみ）しか見えず、
--   「どのAI routeが多いか」「日別推移」「失敗率」「上限拒否/チケット救済の内訳」
--   が分からなかった。これらをroute別・日別に追える最低限のメタデータのみを
--   記録する追加専用の軽量ログテーブルを新設する。
--
-- 【絶対に保存しないもの】
--   AIへの入力本文（word/meaning/text/exam等）、Claudeへのprompt全文、
--   Claudeの生レスポンス本文、メールアドレス等の個人情報。
--   保存するのは「どのroute・成功/失敗・quotaの種類・入出力の文字数(数値)・
--   処理時間(ms)」等のメタデータのみ。
--
-- 【RLS方針】
--   RLSを有効化した上でポリシーを一切追加しない。Supabaseのservice_roleキーは
--   RLSをバイパスするため、このテーブルへの読み書きは常にサーバー側の
--   createAdminClient()(service_role)経由のみに限定される
--   （anon/authenticatedロールからは select/insert とも一切不可）。
--   これにより「admin以外は読めない」を、個別ユーザー向けのポリシー設計をせずに
--   最も単純に保証する。ログ書き込みは各AI routeのハンドラから行うが、
--   通常のユーザーセッション(認証済みクライアント)ではなくservice_role経由で
--   書き込むため、未認証(401)リクエストのログ（user_id=null）も同じ経路で
--   一貫して記録できる。
-- ============================================================

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  route text not null,
  is_premium boolean not null default false,
  status text not null,
  quota_source text,
  error_type text,
  input_size integer,
  output_size integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_events is
  'AI route別の軽量利用ログ（メタデータのみ）。AIへの入力本文・prompt・Claudeの生レスポンスは一切保存しない。read/writeともservice_role経由のみ（RLS有効・ポリシー無し）。';

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at);
create index if not exists ai_usage_events_route_created_at_idx
  on public.ai_usage_events (route, created_at);
create index if not exists ai_usage_events_user_created_at_idx
  on public.ai_usage_events (user_id, created_at);

alter table public.ai_usage_events enable row level security;
-- 意図的にポリシーを追加しない。anon/authenticatedロールからのアクセスは
-- select/insert/update/deleteすべて拒否される。service_roleのみアクセス可能。
