-- Loop Autonomous Improvement System: 観測→課題発見→原因分析→改善仮説→実装計画→
-- コード修正→自動テスト→Draft PR→人間承認→本番反映→効果測定→学習のループを支える
-- (「コード修正」は人間/Claude Codeの対話的セッション、または決定的な小規模修正に
-- 限定されたpatch-agent.mjsが担う。無人スクリプトが任意コードを生成することはない)
-- データ層。Growth OS(analytics_*, growth_*)を土台として利用し、そこに乗らない
-- 「コード修正・PR・テスト実行」の記録を追加する。
--
-- 安全設計の要点(AUTONOMOUS_ENGINEERING_POLICY.md参照):
--   - このスキーマ自体はコードを書かない。あくまで「何を検出したか」「何を承認したか」
--     「何を実行したか」の記録であり、実際のコード変更は別branch上でのみ行われる。
--   - improvement_tasks.status が 'approved' になるまでは実装(engineering-agent.mjs)は
--     一切起動しない。人間承認はアプリのUI操作(profiles.is_adminのユーザーのみ)を経由する。
--   - RLSはGrowth OSと同じ方針: admin専用SELECT、書き込みはservice_role経由のみ。

-- ─────────────────────────────────────────────────────────────
-- improvement_issues: 検出された改善課題そのもの
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_issues (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'acquisition', 'activation', 'retention', 'revenue', 'seo', 'content',
    'reliability', 'performance', 'privacy', 'legal', 'engineering', 'analytics'
  )),
  title text not null,
  problem text not null,
  evidence jsonb not null default '{}'::jsonb,
  affected_users integer,
  affected_urls text[] not null default '{}',
  detected_at timestamptz not null default now(),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  -- confidence/reach/impact/effort/risk はいずれも0.0〜1.0のスコア(priority_score算出に使う)
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  reach numeric not null check (reach >= 0 and reach <= 1),
  impact numeric not null check (impact >= 0 and impact <= 1),
  effort numeric not null check (effort >= 0 and effort <= 1),
  risk numeric not null check (risk >= 0 and risk <= 1),
  priority_score numeric not null default 0,
  source text not null, -- どのanalyzerが検出したか(例: 'seo_scanner', 'reliability_scanner')
  status text not null default 'detected' check (status in (
    'detected', 'investigated', 'proposal_ready', 'approved', 'implementing',
    'draft_pr', 'testing', 'ready_for_review', 'deployed', 'measuring',
    'successful', 'failed', 'rolled_back', 'rejected', 'insufficient_data'
  )),
  proposed_solution text,
  approval_required boolean not null default true,
  implementation_type text check (implementation_type in (
    'code_change', 'content_change', 'config_change', 'investigation_only', 'human_only'
  )),
  -- 重複排除用の安定キー(category + source + 検出対象の正規化識別子)。
  -- 同じ問題が繰り返し検出されても新しい行を作らず、このキーで既存issueを更新する。
  dedup_key text not null,
  autonomy_level smallint not null default 0 check (autonomy_level between 0 and 5),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (dedup_key)
);
create index if not exists improvement_issues_status_idx on improvement_issues (status);
create index if not exists improvement_issues_category_idx on improvement_issues (category);
create index if not exists improvement_issues_priority_idx on improvement_issues (priority_score desc);

alter table improvement_issues enable row level security;
create policy improvement_issues_admin_select on improvement_issues for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy improvement_issues_admin_update on improvement_issues for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
-- INSERT/DELETE: service_role(検出cron)経由のみ。adminはUPDATEでstatus遷移のみ行える
-- (承認/却下/保留などは既存行の更新であり、新規作成や削除はUIから行わせない)。

-- ─────────────────────────────────────────────────────────────
-- improvement_hypotheses: 1つのissueに対する複数の原因仮説
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_hypotheses (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references improvement_issues(id) on delete cascade,
  hypothesis text not null,
  supporting_evidence jsonb not null default '[]'::jsonb,
  contradicting_evidence jsonb not null default '[]'::jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  additional_data_needed text,
  reproduction_steps text,
  status text not null default 'candidate' check (status in (
    'candidate', 'supported', 'refuted', 'inconclusive'
  )),
  created_at timestamptz not null default now()
);
create index if not exists improvement_hypotheses_issue_idx on improvement_hypotheses (issue_id);

alter table improvement_hypotheses enable row level security;
create policy improvement_hypotheses_admin_select on improvement_hypotheses for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─────────────────────────────────────────────────────────────
-- improvement_tasks: 承認された実装計画・実行状況
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_tasks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references improvement_issues(id) on delete cascade,
  hypothesis_id uuid references improvement_hypotheses(id) on delete set null,
  title text not null,
  target_files text[] not null default '{}',
  change_summary text not null,
  db_migration_required boolean not null default false,
  api_change_required boolean not null default false,
  ui_change_required boolean not null default false,
  analytics_change_required boolean not null default false,
  seo_impact text,
  privacy_impact text,
  adsense_impact text,
  billing_impact text,
  rollback_plan text not null,
  required_tests text[] not null default '{}',
  production_checks text[] not null default '{}',
  measurement_plan text,
  autonomy_level smallint not null default 0 check (autonomy_level between 0 and 5),
  -- Level 4/5(自動merge/自動deploy)は今回のシステムでは絶対に到達しない値として
  -- CHECK制約でも二重に縛る(AUTONOMY_LEVEL_POLICY.md参照)。
  status text not null default 'planned' check (status in (
    'planned', 'approved', 'implementing', 'draft_pr', 'testing',
    'ready_for_review', 'changes_requested', 'merged', 'rejected', 'abandoned'
  )),
  branch_name text,
  pr_url text,
  pr_number integer,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint improvement_tasks_autonomy_ceiling check (autonomy_level <= 3)
);
create index if not exists improvement_tasks_issue_idx on improvement_tasks (issue_id);
create index if not exists improvement_tasks_status_idx on improvement_tasks (status);

alter table improvement_tasks enable row level security;
create policy improvement_tasks_admin_select on improvement_tasks for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
create policy improvement_tasks_admin_update on improvement_tasks for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─────────────────────────────────────────────────────────────
-- improvement_runs: engineering-agent.mjs等の実行ログ(scan/implement/test/review)
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references improvement_tasks(id) on delete cascade,
  run_type text not null check (run_type in (
    'scan', 'investigate', 'implement', 'test', 'self_review', 'draft_pr', 'measure'
  )),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary text,
  log jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists improvement_runs_task_idx on improvement_runs (task_id);

alter table improvement_runs enable row level security;
create policy improvement_runs_admin_select on improvement_runs for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─────────────────────────────────────────────────────────────
-- improvement_reviews: 自動コードレビュー(実装担当と論理分離)の結果
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references improvement_tasks(id) on delete cascade,
  reviewer text not null default 'ai_review_agent',
  requirement_met boolean,
  unnecessary_changes boolean,
  security_ok boolean,
  privacy_ok boolean,
  rls_ok boolean,
  billing_ok boolean,
  seo_ok boolean,
  adsense_ok boolean,
  performance_ok boolean,
  mobile_ok boolean,
  accessibility_ok boolean,
  test_coverage_ok boolean,
  regression_risk text,
  rollback_feasible boolean,
  verdict text not null check (verdict in ('approved', 'changes_requested')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists improvement_reviews_task_idx on improvement_reviews (task_id);

alter table improvement_reviews enable row level security;
create policy improvement_reviews_admin_select on improvement_reviews for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ─────────────────────────────────────────────────────────────
-- improvement_memory: 過去の改善(成功・失敗とも)を横断的に記憶し、
-- 「同じ失敗施策を繰り返し提案しない」ための長期メモリ(Phase 12)。
-- improvement_issues/tasksが個々の案件のライフサイクルを表すのに対し、
-- こちらは案件が完了(successful/failed/rolled_back)した後もissue_idを越えて
-- 参照される「教訓」の集合。
-- ─────────────────────────────────────────────────────────────
create table if not exists improvement_memory (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references improvement_issues(id) on delete set null,
  task_id uuid references improvement_tasks(id) on delete set null,
  problem_summary text not null,
  hypothesis_summary text,
  change_summary text,
  pr_url text,
  deployed_at timestamptz,
  metric_before jsonb,
  metric_after jsonb,
  sample_size integer,
  result text check (result in ('success', 'failure', 'inconclusive', 'rolled_back')),
  side_effects text,
  success_reason text,
  failure_reason text,
  reattempt_allowed boolean not null default true,
  next_recommendation text,
  -- 将来同種の課題を検出した際に「これは過去に失敗した施策と同じか」を機械的に
  -- 照合するための正規化キー(improvement_issues.dedup_keyと同じ生成規則を使う)。
  pattern_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists improvement_memory_pattern_idx on improvement_memory (pattern_key);

alter table improvement_memory enable row level security;
create policy improvement_memory_admin_select on improvement_memory for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
