/**
 * Loop Autonomous Improvement System: reflect-pr-ci-result.mjs / 023_improvement_runs_ci_type.sql の回帰テスト。
 *
 * 事故の経緯(2026-07-20発見): improvement_runs.run_type のCHECK制約(019_improvement_system.sql)には
 * reflect-pr-ci-result.mjsが実際に使う 'ci' が含まれておらず、insertは常にCHECK制約違反で
 * 失敗していた。旧コードは .update()/.insert() の戻り値のerrorを一切確認していなかったため、
 * この失敗は握りつぶされ「成功ログを出して正常終了する」状態のまま長期間気づかれなかった
 * (improvement_tasks.status/ci_run_url自体は別カラムで制約に抵触しないため正しく更新されており、
 * 気づきにくい部分的な不整合だった)。
 *
 * 修正: 023_improvement_runs_ci_type.sqlで 'ci' を許可値に追加し、かつ
 * reflect_ci_result() RPCへ「status/ci_run_url更新」と「improvement_runsへのCI実行履歴insert」を
 * 1トランザクションへ一体化(部分成功の防止)。reflect-pr-ci-result.mjs はこのRPCの戻り値の
 * errorを必ず確認し、失敗時は例外を投げてjob自体を失敗させる。
 *
 * このテストは実DBへ接続しない(migration未適用の本番Supabaseに依存しない)静的検証のみを行う:
 * migration SQLファイルとreflect-pr-ci-result.mjsのソースコードをテキストとして検証する。
 *
 * 使い方: node scripts/testing/test-reflect-ci-result.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const MIGRATION_PATH = "supabase/migrations/023_improvement_runs_ci_type.sql";
const ORIGINAL_RUN_TYPES = ["scan", "investigate", "implement", "test", "self_review", "draft_pr", "measure"];

function main() {
  const migrationSql = readFileSync(resolve(REPO_ROOT, MIGRATION_PATH), "utf8");
  const reflectScript = readFileSync(resolve(REPO_ROOT, "scripts/improvement/reflect-pr-ci-result.mjs"), "utf8");

  // ── migrationの静的検査 ──

  // run_type CHECK制約の新しい許可値リストを取り出す(`check (run_type in (\n  'a', 'b', ...\n))`形式)
  const constraintMatch = migrationSql.match(/add constraint improvement_runs_run_type_check check \(run_type in \(([\s\S]*?)\)\);/);
  if (!constraintMatch) {
    fail("migrationにimprovement_runs_run_type_checkの再定義が見つからない");
  } else {
    const values = [...constraintMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (values.includes("ci")) {
      ok("migrationはimprovement_runs.run_typeの許可値に'ci'を追加している");
    } else {
      fail("migrationの新しいrun_type許可値に'ci'が含まれていない");
    }
    const missingOriginal = ORIGINAL_RUN_TYPES.filter((v) => !values.includes(v));
    if (missingOriginal.length === 0) {
      ok("migrationは既存のrun_type許可値(scan/investigate/implement/test/self_review/draft_pr/measure)をすべて維持している");
    } else {
      fail(`migrationが既存のrun_type許可値を削除している: ${missingOriginal.join(", ")}`);
    }
  }

  // 冪等性: drop constraint if exists → add constraint という安全な置き換えパターンになっているか
  if (/drop constraint if exists improvement_runs_run_type_check/.test(migrationSql)) {
    ok("migrationは`drop constraint if exists`で既存制約を安全に(存在しなくてもエラーにならない形で)置き換えている");
  } else {
    fail("migrationがdrop constraint if existsを使っていない(再実行時にエラーになる可能性)");
  }

  // 破壊的操作(テーブル再作成・データ削除・列型変更)が含まれていないこと
  const destructivePatterns = [
    { name: "drop table", re: /drop\s+table/i },
    { name: "truncate", re: /truncate/i },
    { name: "delete from", re: /delete\s+from/i },
    { name: "alter column ... type", re: /alter\s+column\s+\S+\s+type/i },
  ];
  const foundDestructive = destructivePatterns.filter((p) => p.re.test(migrationSql));
  if (foundDestructive.length === 0) {
    ok("migrationにテーブル再作成・データ削除・列型変更などの破壊的操作は含まれていない");
  } else {
    fail(`migrationに破壊的操作が含まれている: ${foundDestructive.map((p) => p.name).join(", ")}`);
  }

  // reflect_ci_result RPCがtask更新とrun insertを同じ関数本体(=1トランザクション)に含んでいる
  const fnMatch = migrationSql.match(/create or replace function reflect_ci_result\([\s\S]*?\$\$;/);
  if (!fnMatch) {
    fail("migrationにreflect_ci_result関数の定義が見つからない");
  } else {
    const fnBody = fnMatch[0];
    if (/update\s+improvement_tasks/i.test(fnBody) && /insert into improvement_runs/i.test(fnBody)) {
      ok("reflect_ci_result()はimprovement_tasksの更新とimprovement_runsへのinsertを同一関数本体(1トランザクション)に含んでいる(部分成功を防止)");
    } else {
      fail("reflect_ci_result()にimprovement_tasks更新・improvement_runs insertの両方が含まれていない");
    }
  }

  // ── reflect-pr-ci-result.mjs の静的検査 ──

  // 旧来の直接insert(.from("improvement_runs").insert()) が残っていない(RPC経由に一本化されている)
  if (!/\.from\(["']improvement_runs["']\)\s*\.\s*insert\(/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsはimprovement_runsへの直接insertを行っていない(reflect_ci_result RPC経由に一本化)");
  } else {
    fail("reflect-pr-ci-result.mjsに旧来のimprovement_runsへの直接insertが残っている(2回書き込みに戻ってしまっている)");
  }

  // reflect_ci_result RPCを呼び出しており、戻り値のerrorを確認している
  const rpcCallMatch = reflectScript.match(/const\s*\{\s*error:\s*(\w+)\s*\}\s*=\s*await\s+admin\s*\.\s*rpc\(\s*["']reflect_ci_result["']/);
  if (!rpcCallMatch) {
    fail("reflect-pr-ci-result.mjsがreflect_ci_result RPCを呼び出していない、またはerrorを分割代入で受け取っていない");
  } else {
    const errVar = rpcCallMatch[1];
    const rpcCallIdx = reflectScript.indexOf(rpcCallMatch[0]);
    const afterRpcCall = reflectScript.slice(rpcCallIdx);
    const throwCheckRe = new RegExp(`if\\s*\\(\\s*${errVar}\\s*\\)\\s*\\{[\\s\\S]*?throw`);
    if (throwCheckRe.test(afterRpcCall)) {
      ok("reflect-pr-ci-result.mjsはreflect_ci_result RPCの戻り値のerrorを確認し、失敗時に例外を投げている");
    } else {
      fail("reflect-pr-ci-result.mjsがRPCのerrorを確認していない、またはerror時に例外を投げていない(握りつぶしている可能性)");
    }

    // 「成功ログ」が、error確認より後ろに書かれていること(errorチェックを迂回して
    // 成功ログへ到達できてしまう構造になっていないか、行の出現順序で確認する)。
    // "status→${newStatus}" は最終成功ログにのみ出現する固有の文字列
    // (冪等性スキップ時のログ等、他の`console.log(\`[reflect] task=`で始まる行と区別するため)
    const successLogIdx = reflectScript.indexOf("status→${newStatus}");
    const throwIdx = afterRpcCall.search(throwCheckRe);
    if (successLogIdx !== -1 && throwIdx !== -1 && successLogIdx > rpcCallIdx + throwIdx) {
      ok("成功ログはRPCのerror確認(throw)より後に書かれている(DBエラー時に成功ログを出して正常終了することがない)");
    } else {
      fail("成功ログの位置が想定外(RPCのerror確認より前、またはerror確認を経由せずに到達できる可能性がある)");
    }
  }

  // findErr(task検索時のerror)も引き続き確認されている(既存の正しい実装を壊していないか)
  if (/findErr\)\s*throw/.test(reflectScript)) {
    ok("task検索(pr_number lookup)のerrorも引き続き確認され、失敗時に例外を投げている");
  } else {
    fail("task検索のerror確認が失われている");
  }

  // CI成功時→ready_for_review、失敗時→ci_failedのマッピングが維持されている(既存test:independent-pr-ciと同種の確認)
  if (/const\s+ciPassed\s*=.*workflowConclusion.*allPassed/.test(reflectScript) && /ciPassed\s*\?\s*"ready_for_review"\s*:\s*"ci_failed"/.test(reflectScript)) {
    ok("CI成功時はready_for_review、失敗時はci_failedというマッピングが維持されている(CI失敗をready_for_reviewにしない)");
  } else {
    fail("CI成功/失敗とstatusのマッピングが想定した形になっていない");
  }

  console.log(failed ? `\n=== test:reflect-ci-result: ${failed}件失敗 ===` : "\n=== test:reflect-ci-result RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
