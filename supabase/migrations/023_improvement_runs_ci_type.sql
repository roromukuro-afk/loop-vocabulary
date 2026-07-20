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
--
-- 注記(2026-07-21、レビューで提起・読み取り専用調査で確認): 本migrationは
-- improvement_runs.run_type のみを変更する。improvement_tasks.status 側の
-- CHECK制約(improvement_tasks_status_check)は意図的に変更していない —
-- 019_improvement_system.sql時点では 'ci_failed' を含んでいなかったが、
-- 021_improvement_claim_and_measurement.sql で既に置き換えられており、
-- 現行の制約定義(本番DBでpg_constraintから直接確認済み)には 'ci_failed' を含む
-- 20種類の値が許可されている。reflect_ci_result()がp_new_status='ci_failed'で
-- improvement_tasks.statusを更新することは、021の時点から既に有効である。

alter table public.improvement_runs drop constraint if exists improvement_runs_run_type_check;
alter table public.improvement_runs add constraint improvement_runs_run_type_check check (run_type in (
  'scan', 'investigate', 'implement', 'test', 'self_review', 'draft_pr', 'measure', 'ci'
));

-- ─────────────────────────────────────────────────────────────
-- reflect_ci_result: 独立PR CIの結果を「improvement_tasksのstatus/ci_run_url更新」と
-- 「improvement_runsへのCI実行履歴insert」の2箇所へ、1つのトランザクションとして
-- 原子的に書き込む。どちらか一方だけが成功する部分成功状態を防ぐ
-- (reflect-pr-ci-result.mjs が個別に2回DB呼び出しをしていた従来方式では、
-- 2回目のinsertがCHECK制約違反等で失敗しても1回目のstatus更新は既にコミット済みのまま
-- 残ってしまう問題があった)。
--
-- 権限境界(2026-07-20追加のレビュー指摘への対応):
--   - SECURITY DEFINER にはしない。SECURITY INVOKER(未指定時のPostgreSQLデフォルトと
--     同じ)のまま明示する。呼び出し元(service_role)自身の権限で実行され、定義者
--     (テーブル所有者)の権限へ昇格しない。service_roleはSupabase上でRLSを
--     バイパスする(bypassrls)ため、SECURITY DEFINERでRLSを回避する必要が無い。
--   - `set search_path = ''` で検索パスを完全に空にする。関数本体内のテーブル参照は
--     すべて `public.` で完全修飾しており、検索パス経由でのオブジェクト差し替え
--     (search_path hijacking)の余地が無い。
--   - デフォルトではPostgreSQLは新規作成した関数のEXECUTE権限をPUBLICへ自動付与する。
--     これを明示的にrevokeし、service_roleにのみgrantする。anon/authenticatedロールは
--     このRPCを一切呼び出せない(以前はRLSにのみ依存した弱い防御だった)。
--
-- 入力値検証: p_new_status/p_run_statusは許可値のみを受け付け、両者の組み合わせが
-- 矛盾している場合(例: ready_for_reviewなのにp_run_status=failed)もupdate/insert前に
-- 例外を発生させる。呼び出し元(reflect-pr-ci-result.mjs)のロジックバグや、将来の
-- 呼び出し元追加時の誤用を、DB側でも防ぐ。
--
-- terminal status保護: UPDATE自体のWHERE句で終端状態(merged/rejected/abandoned/
-- deployed/measuring/successful/failed/inconclusive/rolled_back — reflect-pr-ci-result.mjs
-- のJS側terminalStatusesと同じ集合)を除外する。JS側の事前SELECT確認だけに頼らず、
-- 「人間が手動mergeした直後にreflect workflowが古いrunの結果を反映しようとする」
-- ようなレース条件でも、DBのUPDATE自体がterminal行を対象から除外するため
-- 上書きされ得ない(TOCTOUではなく、1回のUPDATE文自体がatomicに保護する)。
-- 対象0件だった場合は、「task IDが存在しない」「terminal状態のため保護された」
-- 「その他予期しない理由」を区別してraise exceptionする。
-- ─────────────────────────────────────────────────────────────
create or replace function public.reflect_ci_result(
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
security invoker
set search_path = ''
as $$
declare
  v_updated_id uuid;
  v_current_status text;
  v_terminal_statuses constant text[] := array[
    'merged', 'rejected', 'abandoned', 'deployed', 'measuring',
    'successful', 'failed', 'inconclusive', 'rolled_back'
  ];
begin
  if p_new_status not in ('ready_for_review', 'ci_failed') then
    raise exception 'reflect_ci_result: invalid p_new_status "%": must be ready_for_review or ci_failed', p_new_status;
  end if;

  if p_run_status not in ('succeeded', 'failed') then
    raise exception 'reflect_ci_result: invalid p_run_status "%": must be succeeded or failed', p_run_status;
  end if;

  if (p_new_status = 'ready_for_review' and p_run_status <> 'succeeded')
     or (p_new_status = 'ci_failed' and p_run_status <> 'failed') then
    raise exception 'reflect_ci_result: inconsistent combination p_new_status="%" / p_run_status="%"', p_new_status, p_run_status;
  end if;

  update public.improvement_tasks
  set status = p_new_status,
      ci_run_url = p_ci_run_url
  where id = p_task_id
    and status <> all (v_terminal_statuses)
  returning id into v_updated_id;

  if v_updated_id is null then
    select status into v_current_status from public.improvement_tasks where id = p_task_id;

    if v_current_status is null then
      raise exception 'reflect_ci_result: task % does not exist', p_task_id;
    elsif v_current_status = any (v_terminal_statuses) then
      raise exception 'reflect_ci_result: task % is in terminal status "%", refusing to overwrite', p_task_id, v_current_status;
    else
      raise exception 'reflect_ci_result: task % could not be updated from status "%" for an unexpected reason', p_task_id, v_current_status;
    end if;
  end if;

  insert into public.improvement_runs (task_id, run_type, status, finished_at, summary, log)
  values (p_task_id, 'ci', p_run_status, p_finished_at, p_run_summary, p_run_log);
end;
$$;

comment on function public.reflect_ci_result is
  '独立PR CI(pr-quality-gate.yml)の結果をimprovement_tasks.status/ci_run_urlの更新と'
  'improvement_runsへのCI実行履歴insertへ、1トランザクションとして原子的に反映する。'
  'SECURITY INVOKER、search_pathは空文字列に固定、service_roleのみEXECUTE可能。'
  'reflect-pr-ci-result.mjs(workflow_runトリガー、信頼コンテキスト)からのみ呼ばれる想定。';

revoke all on function public.reflect_ci_result(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
) from public;

revoke all on function public.reflect_ci_result(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
) from anon;

revoke all on function public.reflect_ci_result(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
) from authenticated;

grant execute on function public.reflect_ci_result(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
) to service_role;
