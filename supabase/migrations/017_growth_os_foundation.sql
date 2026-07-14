-- Growth OS foundation: ファーストパーティイベント基盤・日次集計・異常検知・A/Bテスト・週次レポート
-- 2026-07-12 に Supabase MCP 経由で本番へ適用済み（apply_migration name: growth_os_foundation）。
-- このファイルはリポジトリ内でのマイグレーション履歴を残すための記録用。

-- Growth OS Phase 1: ファーストパーティイベント基盤
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  anonymous_session_id text,
  user_id uuid references profiles(id) on delete set null,
  page_type text,
  path text,
  source text,
  campaign text,
  device_category text,
  properties jsonb not null default '{}'::jsonb,
  experiment_id uuid,
  variant_id uuid,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_name_occurred_at_idx on analytics_events (event_name, occurred_at);
create index if not exists analytics_events_user_id_occurred_at_idx on analytics_events (user_id, occurred_at);
create index if not exists analytics_events_anon_session_occurred_at_idx on analytics_events (anonymous_session_id, occurred_at);
create index if not exists analytics_events_occurred_at_idx on analytics_events (occurred_at);

alter table analytics_events enable row level security;
create policy analytics_events_admin_select on analytics_events for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
-- INSERT/UPDATE/DELETE: サーバー(service_role)経由のみ。ユーザー向けポリシーは意図的に作成しない。

-- Growth OS Phase 3: 日次・週次集計テーブル
create table if not exists analytics_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  metric_name text not null,
  dimension text not null default '',
  value numeric not null default 0,
  computed_at timestamptz not null default now(),
  unique (metric_date, metric_name, dimension)
);
create index if not exists analytics_daily_metrics_name_date_idx on analytics_daily_metrics (metric_name, metric_date);

create table if not exists analytics_daily_funnels (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  funnel_key text not null,
  step_key text not null,
  step_order smallint not null,
  count integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (metric_date, funnel_key, step_key)
);

create table if not exists analytics_retention_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_week date not null,
  day_offset smallint not null,
  cohort_size integer not null default 0,
  retained_count integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (cohort_week, day_offset)
);

create table if not exists analytics_content_performance (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  content_type text not null,
  content_key text not null,
  views integer not null default 0,
  conversions integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (metric_date, content_type, content_key)
);

create table if not exists analytics_revenue_daily (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  mrr numeric not null default 0,
  arr numeric not null default 0,
  new_subscriptions integer not null default 0,
  cancellations integer not null default 0,
  reactivations integer not null default 0,
  active_monthly integer not null default 0,
  active_yearly integer not null default 0,
  ai_cost_estimate numeric not null default 0,
  computed_at timestamptz not null default now()
);

alter table analytics_daily_metrics enable row level security;
alter table analytics_daily_funnels enable row level security;
alter table analytics_retention_cohorts enable row level security;
alter table analytics_content_performance enable row level security;
alter table analytics_revenue_daily enable row level security;

create policy adm_admin_select on analytics_daily_metrics for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy adf_admin_select on analytics_daily_funnels for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy arc_admin_select on analytics_retention_cohorts for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy acp_admin_select on analytics_content_performance for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy ard_admin_select on analytics_revenue_daily for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Growth OS Phase 5: 自動分析・異常検知
create table if not exists growth_insights (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  rule_key text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  period_start date,
  period_end date,
  affected_users integer,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  recommended_action text,
  expected_metric text,
  risk text,
  implementation_effort text check (implementation_effort in ('low','medium','high')),
  status text not null default 'new' check (status in ('new','acknowledged','dismissed','resolved')),
  human_approved boolean not null default false
);
create index if not exists growth_insights_rule_key_idx on growth_insights (rule_key, detected_at);

create table if not exists growth_alerts (
  id uuid primary key default gen_random_uuid(),
  triggered_at timestamptz not null default now(),
  rule_key text not null,
  message text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  metric_value numeric,
  threshold_value numeric,
  status text not null default 'open' check (status in ('open','resolved','snoozed'))
);

create table if not exists growth_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_insight_id uuid references growth_insights(id) on delete set null,
  title text not null,
  rationale text not null,
  proposed_experiment_key text,
  status text not null default 'proposed' check (status in ('proposed','draft_created','rejected','implemented'))
);

alter table growth_insights enable row level security;
alter table growth_alerts enable row level security;
alter table growth_recommendations enable row level security;
create policy gi_admin_select on growth_insights for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy ga_admin_select on growth_alerts for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy gr_admin_select on growth_recommendations for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy gi_admin_update on growth_insights for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy gr_admin_update on growth_recommendations for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Growth OS Phase 7: A/Bテスト基盤
create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  hypothesis text,
  primary_metric text not null,
  guardrail_metric text,
  status text not null default 'draft' check (status in ('draft','approved','running','paused','completed')),
  min_sample_per_variant integer not null default 200,
  min_duration_days integer not null default 7,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  winner_variant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  key text not null,
  name text not null,
  is_control boolean not null default false,
  traffic_weight numeric not null default 0.5,
  created_at timestamptz not null default now(),
  unique (experiment_id, key)
);

alter table experiments add constraint experiments_winner_variant_fk foreign key (winner_variant_id) references experiment_variants(id) on delete set null;

create table if not exists experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  variant_id uuid not null references experiment_variants(id) on delete cascade,
  anonymous_session_id text,
  user_id uuid references profiles(id) on delete set null,
  subject_key text not null generated always as (coalesce(user_id::text, anonymous_session_id)) stored,
  assigned_at timestamptz not null default now(),
  unique (experiment_id, subject_key)
);

create table if not exists experiment_exposures (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  variant_id uuid not null references experiment_variants(id) on delete cascade,
  anonymous_session_id text,
  user_id uuid references profiles(id) on delete set null,
  subject_key text not null generated always as (coalesce(user_id::text, anonymous_session_id)) stored,
  exposed_at timestamptz not null default now(),
  unique (experiment_id, subject_key)
);

create table if not exists experiment_conversions (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  variant_id uuid not null references experiment_variants(id) on delete cascade,
  metric_name text not null,
  anonymous_session_id text,
  user_id uuid references profiles(id) on delete set null,
  value numeric not null default 1,
  converted_at timestamptz not null default now()
);
create index if not exists experiment_conversions_exp_metric_idx on experiment_conversions (experiment_id, metric_name);

alter table experiments enable row level security;
alter table experiment_variants enable row level security;
alter table experiment_assignments enable row level security;
alter table experiment_exposures enable row level security;
alter table experiment_conversions enable row level security;
create policy exp_admin_select on experiments for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy exp_admin_update on experiments for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy expv_admin_select on experiment_variants for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy expa_admin_select on experiment_assignments for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy expe_admin_select on experiment_exposures for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy expc_admin_select on experiment_conversions for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Growth OS Phase 9: 週次レポート
create table if not exists growth_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  north_star_value integer,
  north_star_prev_value integer,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

alter table growth_weekly_reports enable row level security;
create policy gwr_admin_select on growth_weekly_reports for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
