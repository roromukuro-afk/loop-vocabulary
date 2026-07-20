-- Loop Autonomous Improvement System: improvement_runs.run_type に 'ci' を追加する。
--
-- 背景(2026-07-20発見): reflect-pr-ci-result.mjs(独立PR Quality Gateの結果をSupabaseへ
-- 反映するworkflow_runトリガーのスクリプト)は improvement_runs へ run_type: "ci" で
-- insertしているが、019_improvement_system.sqlで定義された当初のCHECK制約
-- (scan/investigate/implement/test/self_review/draft_pr/measure のみ許可)には
-- 'ci' が含まれておらず、insertは常にCHECK制約違反で失敗していた(以前のコードが
-- Supabaseクライアントの戻り値のerrorを確認していなかったため、この失敗は握りつぶされて
-- 気づかれていなかった — 別途アプリコード側も本migrationと同じPRで修正する)。
--
-- 既存の許可値はすべて維持し、'ci' のみを追加する。テーブル再作成・既存データ削除・
-- 列型変更は行わない(制約の置き換えのみ)。

alter table improvement_runs drop constraint if exists improvement_runs_run_type_check;
alter table improvement_runs add constraint improvement_runs_run_type_check check (run_type in (
  'scan', 'investigate', 'implement', 'test', 'self_review', 'draft_pr', 'measure', 'ci'
));

-- ─────────────────────────────────────────────────────────────
-- reflect_ci_result: 独立PR CIの結果を「improvement_tasksのstatus/ci_run_url更新」と
-- 「improvement_runsへのCI実行履歴insert」の2箇所へ、1つのトランザクションとして
-- 原子的に書き込む。どちらか一方だけが成功する部分成功状態を防ぐ
-- (reflect-pr-ci-result.mjs が個別に2回DB呼び出しをしていた従来方式では、
-- 2回目のinsertがCHECK制約違反等で失敗しても1回目のstatus更新は既にコミット済みのまま
-- 残ってしまう問題があった)。
-- ─────────────────────────────────────────────────────────────
create or replace function reflect_ci_result(
  p_task_id uuid,
  p_new_status text,
  p_ci_run_url text,
  p_run_status text,
  p_run_summary text,
  p_run_log jsonb,
  p_finished_at timestamptz
)
returns void
language plpgsql
as $$
begin
  update improvement_tasks
  set status = p_new_status,
      ci_run_url = p_ci_run_url
  where id = p_task_id;

  insert into improvement_runs (task_id, run_type, status, finished_at, summary, log)
  values (p_task_id, 'ci', p_run_status, p_finished_at, p_run_summary, p_run_log);
end;
$$;

comment on function reflect_ci_result is
  '独立PR CI(pr-quality-gate.yml)の結果をimprovement_tasks.status/ci_run_urlの更新と'
  'improvement_runsへのCI実行履歴insertへ、1トランザクションとして原子的に反映する。'
  'reflect-pr-ci-result.mjs(workflow_runトリガー、信頼コンテキスト)からのみ呼ばれる想定。';
