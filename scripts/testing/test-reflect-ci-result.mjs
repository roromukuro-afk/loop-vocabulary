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
 * 権限境界の追加レビュー指摘(2026-07-21)への対応:
 * - SECURITY DEFINERにはせず、SECURITY INVOKER + search_path=''を明示。service_roleのみ
 *   EXECUTE可能(PUBLIC/anon/authenticatedからは明示的にrevoke)。
 * - p_new_status/p_run_statusの許可値・組み合わせをDB側でも検証する。
 * - terminal status(merged/rejected/abandoned等)をUPDATEのWHERE句自体で保護し、
 *   対象0件時は理由を区別してraise exceptionする(UPDATE対象0件を成功扱いにしない)。
 *
 * このテストは実DBへ接続しない(migration未適用の本番Supabaseに依存しない)静的検証のみを行う:
 * migration SQLファイルとreflect-pr-ci-result.mjsのソースコードをテキストとして検証する。
 * SQLのコメント行(`--`始まり)は検査対象から除去してから照合する — でないと、コメント中に
 * "security invoker"等の語がプレーズとして書かれているだけで誤PASSしてしまう
 * (実際、このmigration自身の説明コメントにこれらの語を含んでいるため、コメント除去は必須)。
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
const FN_SIGNATURE = "uuid,\n  text,\n  text,\n  text,\n  text,\n  jsonb,\n  timestamptz";

/** SQLの行コメント(`--`始まりの行)を除去する。文字列リテラル内の`--`は考慮しない
 * (このmigrationファイル自体にリテラル内`--`が無いことは目視確認済み)。 */
function stripSqlComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function main() {
  const migrationSqlRaw = readFileSync(resolve(REPO_ROOT, MIGRATION_PATH), "utf8");
  const migrationSql = stripSqlComments(migrationSqlRaw);
  const reflectScript = readFileSync(resolve(REPO_ROOT, "scripts/improvement/reflect-pr-ci-result.mjs"), "utf8");

  // ── migrationの静的検査: run_type制約 ──

  const constraintMatch = migrationSql.match(/add constraint improvement_runs_run_type_check check \(run_type in \(([\s\S]*?)\)\);/);
  if (!constraintMatch) {
    fail("migrationにimprovement_runs_run_type_checkの再定義が見つからない");
  } else {
    const values = [...constraintMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (values.includes("ci")) ok("migrationはimprovement_runs.run_typeの許可値に'ci'を追加している");
    else fail("migrationの新しいrun_type許可値に'ci'が含まれていない");

    const missingOriginal = ORIGINAL_RUN_TYPES.filter((v) => !values.includes(v));
    if (missingOriginal.length === 0) {
      ok("migrationは既存のrun_type許可値(scan/investigate/implement/test/self_review/draft_pr/measure)をすべて維持している");
    } else {
      fail(`migrationが既存のrun_type許可値を削除している: ${missingOriginal.join(", ")}`);
    }
  }

  if (/alter table public\.improvement_runs drop constraint if exists improvement_runs_run_type_check/.test(migrationSql)) {
    ok("run_type制約の変更はpublic.improvement_runsとしてschema-qualifiedに行われ、drop constraint if existsで冪等に置き換えている");
  } else {
    fail("run_type制約の変更がpublic.improvement_runsとしてschema-qualifiedになっていない、またはdrop constraint if existsを使っていない");
  }

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

  // ── migrationの静的検査: reflect_ci_result関数本体 ──

  // 関数のヘッダ(create ... から `as $$` 直前まで)とボディ(`$$ ... $$;`)を分離して取り出す。
  // コメント除去済みのテキストに対して行うため、プレーズがコメント中にあるだけでは一致しない。
  const fnHeaderMatch = migrationSql.match(
    /create or replace function public\.reflect_ci_result\(([\s\S]*?)\)\s*returns\s+void\s*([\s\S]*?)as \$\$([\s\S]*?)\$\$;/,
  );
  if (!fnHeaderMatch) {
    fail("migrationにpublic.reflect_ci_result関数の定義(schema-qualified)が見つからない");
  } else {
    ok("関数はpublic.reflect_ci_resultとしてschema-qualifiedに作成されている");

    const modifiers = fnHeaderMatch[2];
    if (/\bsecurity\s+invoker\b/i.test(modifiers)) {
      ok("関数定義自体にsecurity invokerが指定されている(コメントではなく実際のCREATE FUNCTION句として)");
    } else {
      fail("関数定義にsecurity invokerが指定されていない(security definerになっている、または未指定の可能性)");
    }
    if (/\bsecurity\s+definer\b/i.test(modifiers)) {
      fail("関数定義にsecurity definerが指定されている(security invokerであるべき)");
    }
    if (/set\s+search_path\s*=\s*''/.test(modifiers)) {
      ok("関数定義自体にset search_path = ''が指定されている(実際のCREATE FUNCTION句として)");
    } else {
      fail("関数定義にset search_path = ''が指定されていない");
    }

    const fnBody = fnHeaderMatch[3];
    if (/update\s+public\.improvement_tasks/i.test(fnBody)) {
      ok("関数本体はpublic.improvement_tasksへschema-qualifiedな形でUPDATEしている");
    } else {
      fail("関数本体がpublic.improvement_tasksへschema-qualifiedな形でUPDATEしていない");
    }
    if (/insert into public\.improvement_runs/i.test(fnBody)) {
      ok("関数本体はpublic.improvement_runsへschema-qualifiedな形でINSERTしている(1トランザクション内、部分成功を防止)");
    } else {
      fail("関数本体がpublic.improvement_runsへschema-qualifiedな形でINSERTしていない");
    }
    // 修飾されていない裸のテーブル参照が残っていないか(schema-qualification漏れの検出)
    if (/[^.]\bupdate\s+improvement_tasks\b/i.test(fnBody) || /\binsert into\s+improvement_runs\b/i.test(fnBody)) {
      fail("関数本体にschema修飾されていない裸のテーブル参照(improvement_tasks/improvement_runs)が残っている");
    } else {
      ok("関数本体に修飾漏れの裸テーブル参照は残っていない");
    }

    // 入力値検証: p_new_status / p_run_status の許可値
    if (/p_new_status not in \('ready_for_review',\s*'ci_failed'\)/.test(fnBody) && /raise exception/i.test(fnBody)) {
      ok("関数本体はp_new_statusをready_for_review/ci_failedのみに限定し、それ以外はraise exceptionする");
    } else {
      fail("p_new_statusの許可値検証(ready_for_review/ci_failedのみ)が関数本体に見当たらない");
    }
    if (/p_run_status not in \('succeeded',\s*'failed'\)/.test(fnBody)) {
      ok("関数本体はp_run_statusをsucceeded/failedのみに限定している");
    } else {
      fail("p_run_statusの許可値検証(succeeded/failedのみ)が関数本体に見当たらない");
    }
    // 組み合わせ検証: ready_for_review⇔succeeded、ci_failed⇔failed の不整合を拒否する分岐
    if (
      /p_new_status\s*=\s*'ready_for_review'\s*and\s*p_run_status\s*<>\s*'succeeded'/.test(fnBody) &&
      /p_new_status\s*=\s*'ci_failed'\s*and\s*p_run_status\s*<>\s*'failed'/.test(fnBody)
    ) {
      ok("関数本体はp_new_status/p_run_statusの組み合わせ矛盾(ready_for_review⇔succeeded、ci_failed⇔failed以外)を拒否している");
    } else {
      fail("p_new_status/p_run_statusの組み合わせ検証が関数本体に見当たらない");
    }

    // terminal status保護: 少なくともmerged/rejected/abandonedを含む配列がUPDATEのWHERE句で使われている
    const terminalArrayMatch = fnBody.match(/v_terminal_statuses constant text\[\] := array\[([\s\S]*?)\]/);
    if (!terminalArrayMatch) {
      fail("terminal status一覧(v_terminal_statuses)が関数本体に見当たらない");
    } else {
      const terminalValues = [...terminalArrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      const requiredTerminal = ["merged", "rejected", "abandoned"];
      const missingTerminal = requiredTerminal.filter((v) => !terminalValues.includes(v));
      if (missingTerminal.length === 0) {
        ok("terminal status一覧は少なくともmerged/rejected/abandonedを含んでいる(これらのstatusは上書きされない)");
      } else {
        fail(`terminal status一覧に不足がある: ${missingTerminal.join(", ")}`);
      }
      if (/where id = p_task_id\s*\r?\n\s*and status <> all \(v_terminal_statuses\)/.test(fnBody)) {
        ok("UPDATE自体のWHERE句がterminal statusを除外している(JS側の事前チェックだけに頼らずDB側でも保護)");
      } else {
        fail("UPDATEのWHERE句にterminal status除外条件(status <> all (v_terminal_statuses))が見当たらない");
      }
    }

    // UPDATE対象0件を成功扱いにしない: returning + null チェック + raise exception の3点セット
    if (/returning id into v_updated_id/.test(fnBody) && /if v_updated_id is null then/.test(fnBody)) {
      const nullBranch = fnBody.slice(fnBody.indexOf("if v_updated_id is null then"));
      if (/does not exist/.test(nullBranch) && /terminal status/.test(nullBranch) && /unexpected reason/.test(nullBranch)) {
        ok("UPDATE対象0件の場合、成功扱いにせず「存在しない/terminal状態/その他予期しない理由」を区別してraise exceptionしている");
      } else {
        fail("UPDATE対象0件時の分岐が、3種類の理由を区別してraise exceptionする形になっていない");
      }
    } else {
      fail("UPDATE対象0件を検出する仕組み(returning + null チェック)が関数本体に見当たらない");
    }
  }

  // ── migrationの静的検査: EXECUTE権限(PUBLIC/anon/authenticatedからrevoke、service_roleへgrant)──
  // コメント文中の言及ではなく、実際のREVOKE/GRANT文(関数シグネチャつき)を検査する。

  const normalizedSignature = FN_SIGNATURE.replace(/\s+/g, " ").trim();
  const normalizedMigration = migrationSql.replace(/\s+/g, " ").trim();

  const revokeChecks = [
    { role: "public", label: "PUBLIC" },
    { role: "anon", label: "anon" },
    { role: "authenticated", label: "authenticated" },
  ];
  for (const { role, label } of revokeChecks) {
    const re = new RegExp(
      `revoke all on function public\\.reflect_ci_result\\( ${normalizedSignature.split(",").map((s) => s.trim()).join(", ")} \\) from ${role};`,
    );
    if (re.test(normalizedMigration)) {
      ok(`public.reflect_ci_result(uuid,text,text,text,text,jsonb,timestamptz)のEXECUTE権限が${label}からrevokeされている`);
    } else {
      fail(`${label}からのEXECUTE revoke文(正確な引数シグネチャつき)が見つからない`);
    }
  }
  {
    const re = new RegExp(
      `grant execute on function public\\.reflect_ci_result\\( ${normalizedSignature.split(",").map((s) => s.trim()).join(", ")} \\) to service_role;`,
    );
    if (re.test(normalizedMigration)) {
      ok("public.reflect_ci_result(uuid,text,text,text,text,jsonb,timestamptz)のEXECUTE権限がservice_roleにのみgrantされている");
    } else {
      fail("service_roleへのEXECUTE grant文(正確な引数シグネチャつき)が見つからない");
    }
  }

  // ── migrationファイル自体に自動承認・自動ready化・自動merge・自動deploy相当の操作が無いこと ──
  // (test:no-automated-*群は scripts/improvement/*.mjs と .github/workflows/*.yml のみ走査するため、
  // supabase/migrations/*.sql はこの回帰テストで独自に確認する)
  const automationPatterns = [
    { name: "gh pr merge / auto-merge", re: /gh\s+pr\s+merge|auto[_-]?merge/i },
    { name: "gh pr review --approve", re: /gh\s+pr\s+review.*approve/i },
    { name: "gh pr ready", re: /gh\s+pr\s+ready/i },
    { name: "vercel deploy / production deploy", re: /vercel\s+deploy|deploy\s+--prod/i },
  ];
  const foundAutomation = automationPatterns.filter((p) => p.re.test(migrationSql));
  if (foundAutomation.length === 0) {
    ok("migrationファイルに自動approve・自動ready化・自動merge・自動deploy相当の操作は含まれていない");
  } else {
    fail(`migrationファイルに自動化操作の疑いがあるパターンが含まれている: ${foundAutomation.map((p) => p.name).join(", ")}`);
  }

  // ── reflect-pr-ci-result.mjs の静的検査 ──

  if (!/\.from\(["']improvement_runs["']\)\s*\.\s*insert\(/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsはimprovement_runsへの直接insertを行っていない(reflect_ci_result RPC経由に一本化)");
  } else {
    fail("reflect-pr-ci-result.mjsに旧来のimprovement_runsへの直接insertが残っている(2回書き込みに戻ってしまっている)");
  }

  const rpcCallMatch = reflectScript.match(/const\s*\{\s*error:\s*(\w+)\s*\}\s*=\s*await\s+admin\s*\.\s*rpc\(\s*["']reflect_ci_result["']/);
  if (!rpcCallMatch) {
    fail("reflect-pr-ci-result.mjsがreflect_ci_result RPCを呼び出していない、またはerrorを分割代入で受け取っていない");
  } else {
    const errVar = rpcCallMatch[1];
    const rpcCallIdx = reflectScript.indexOf(rpcCallMatch[0]);
    const afterRpcCall = reflectScript.slice(rpcCallIdx);
    const throwCheckRe = new RegExp(`if\\s*\\(\\s*${errVar}\\s*\\)\\s*\\{[\\s\\S]*?throw`);
    if (throwCheckRe.test(afterRpcCall)) {
      ok("reflect-pr-ci-result.mjsはreflect_ci_result RPCの戻り値のerrorを確認し、失敗時に例外を投げている(DBエラー時に成功扱いで正常終了しない)");
    } else {
      fail("reflect-pr-ci-result.mjsがRPCのerrorを確認していない、またはerror時に例外を投げていない(握りつぶしている可能性)");
    }

    const successLogIdx = reflectScript.indexOf("status→${newStatus}");
    const throwIdx = afterRpcCall.search(throwCheckRe);
    if (successLogIdx !== -1 && throwIdx !== -1 && successLogIdx > rpcCallIdx + throwIdx) {
      ok("成功ログはRPCのerror確認(throw)より後に書かれている(DBエラー時に成功ログを出して正常終了することがない)");
    } else {
      fail("成功ログの位置が想定外(RPCのerror確認より前、またはerror確認を経由せずに到達できる可能性がある)");
    }
  }

  if (/findErr\)\s*throw/.test(reflectScript)) {
    ok("task検索(pr_number lookup)のerrorも引き続き確認され、失敗時に例外を投げている");
  } else {
    fail("task検索のerror確認が失われている");
  }

  if (/const\s+ciPassed\s*=.*workflowConclusion.*allPassed/.test(reflectScript) && /ciPassed\s*\?\s*"ready_for_review"\s*:\s*"ci_failed"/.test(reflectScript)) {
    ok("CI成功時はready_for_review、失敗時はci_failedというマッピングが維持されている(CI失敗をready_for_reviewにしない)");
  } else {
    fail("CI成功/失敗とstatusのマッピングが想定した形になっていない");
  }

  console.log(failed ? `\n=== test:reflect-ci-result: ${failed}件失敗 ===` : "\n=== test:reflect-ci-result RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
