-- Loop Autonomous Improvement System: 承認済みタスクの原子的claim + デプロイ後効果測定の
-- 状態を追加する。既存の improvement_issues / improvement_tasks を拡張する。

-- ─────────────────────────────────────────────────────────────
-- improvement_tasks: claim追跡・CI結果・commit情報・測定データの追加
-- ─────────────────────────────────────────────────────────────
alter table improvement_tasks
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists commit_sha text,
  add column if not exists ci_run_url text,
  add column if not exists measurement jsonb;

comment on column improvement_tasks.claimed_by is
  'claim_next_improvement_task()を呼び出したworkerの識別子(例: GitHub Actionsのrun id)。secretや個人情報は含めない。';
comment on column improvement_tasks.measurement is
  'デプロイ後の効果測定データ。{merge_commit, deployment_id, deployed_at, measurement_started_at, '
  'measurement_ends_at, primary_metric, guardrail_metrics, baseline_period, comparison_period, '
  'baseline:{numerator,denominator}, result:{numerator,denominator}, sample_size, effect_size, '
  'side_effects, final_decision, learning} の形式。';

-- statusにclaim/CI/測定関連の状態を追加
alter table improvement_tasks drop constraint if exists improvement_tasks_status_check;
alter table improvement_tasks add constraint improvement_tasks_status_check check (status in (
  'planned', 'approved', 'claimed', 'implementing', 'draft_pr', 'testing',
  'ci_failed', 'needs_human_planning', 'ready_for_retry',
  'ready_for_review', 'changes_requested', 'merged', 'rejected', 'abandoned',
  'deployed', 'measuring', 'successful', 'failed', 'inconclusive', 'rolled_back'
));

create index if not exists improvement_tasks_claimed_idx on improvement_tasks (status, claimed_at);

-- ─────────────────────────────────────────────────────────────
-- improvement_issues: 管理画面のタブ分類に合わせてstatusを拡張
-- ─────────────────────────────────────────────────────────────
alter table improvement_issues drop constraint if exists improvement_issues_status_check;
alter table improvement_issues add constraint improvement_issues_status_check check (status in (
  'detected', 'investigated', 'proposal_ready', 'approved', 'implementing',
  'draft_pr', 'testing', 'ci_failed', 'needs_human_planning',
  'ready_for_review', 'deployed', 'measuring',
  'successful', 'failed', 'rolled_back', 'rejected', 'insufficient_data',
  'inconclusive', 'postponed'
));

-- ─────────────────────────────────────────────────────────────
-- 原子的claim: FOR UPDATE SKIP LOCKED で1件だけ排他的に取得する。
-- 複数のworker(GitHub Actions runner)が同時に呼んでも、必ず異なる行を取得するか、
-- 対象が無ければNULLを返す(競合しない)。stale_after_minutesを超えて
-- claimed/implementing のまま進んでいないタスクも再claim対象に含める(stale recovery)。
-- Level 0〜2および未承認(approved以外)・autonomy_level>3のタスクは対象外
-- (AUTONOMY_LEVEL_POLICY.md: Level3までかつ人間承認済みのみ自動実装対象)。
-- ─────────────────────────────────────────────────────────────
create or replace function claim_next_improvement_task(
  worker_id text,
  stale_after_minutes int default 120
)
returns setof improvement_tasks
language plpgsql
as $$
begin
  return query
  update improvement_tasks
  set status = 'claimed',
      claimed_at = now(),
      claimed_by = worker_id,
      updated_at = now()
  where id = (
    select t.id
    from improvement_tasks t
    where
      (t.status = 'approved' and t.autonomy_level = 3)
      or (
        t.status in ('claimed', 'implementing')
        and t.claimed_at is not null
        and t.claimed_at < now() - (stale_after_minutes || ' minutes')::interval
      )
    order by t.created_at asc
    limit 1
    for update skip locked
  )
  returning improvement_tasks.*;
end;
$$;

comment on function claim_next_improvement_task is
  '承認済み(status=approved かつ autonomy_level=3)のタスクを1件だけ原子的にclaimする。'
  'FOR UPDATE SKIP LOCKEDにより同時実行しても重複claimしない。stale_after_minutesを超えて'
  'claimed/implementingのまま進んでいないタスクも回復対象として再claimする。';
