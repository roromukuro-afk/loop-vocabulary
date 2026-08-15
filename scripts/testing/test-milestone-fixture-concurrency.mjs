/**
 * test-insert-once-per-user-milestone-event.mjs の並行実行安全性の回帰テスト。
 *
 * 背景(Codexレビュー指摘): 以前はis_test_account=trueの既存共有プロフィールを
 * `limit(1)`で借用し、「退避→削除→挿入→片付け→復元」という非トランザクション的な
 * 手順を踏んでいた。2つのテスト実行(別プロセス・別マシン含む)が同時に同じ
 * プロフィールを選ぶと、一方の実行の復元処理が他方の実行の後片付けに巻き込まれて
 * 消えてしまい、共有フィクスチャの本物のマイルストーン記録を破壊し得た。
 *
 * 対応: 各テスト実行が使い捨て専用ユーザー(admin.auth.admin.createUser())を
 * 毎回新規作成するよう変更し、他の実行や既存の共有テストアカウントのデータに
 * 一切触れない設計にした。このテストは、その設計変更が実際に並行実行安全である
 * ことを直接検証する。
 *
 * 検証内容:
 *  1. test:insert-once-per-user-milestone-eventを2プロセス同時に起動する
 *  2. 両方とも正常終了(exit code 0)する
 *  3. 実行前後で、以前共有フィクスチャとして使われていたis_test_account=trueの
 *     先頭プロフィール(limit 1)のreturn_next_day/return_day_7行が完全に不変である
 *     (=並行実行がそのプロフィールに一切触れていないことの直接証拠)
 *  4. 両実行が作った使い捨てユーザー(test+milestone-*)が、実行後に1件も残っていない
 *
 * 使い方: node scripts/testing/test-milestone-fixture-concurrency.mjs
 */
import { spawn } from "child_process";
import { resolve } from "path";
import { loadEnv, requireEnv, REPO_ROOT } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const TARGET_SCRIPT = resolve(REPO_ROOT, "scripts/testing/test-insert-once-per-user-milestone-event.mjs");

function runInvocation(label) {
  return new Promise((resolvePromise) => {
    const proc = spawn(process.execPath, [TARGET_SCRIPT], { cwd: REPO_ROOT, env: process.env });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolvePromise({ label, code, stdout, stderr }));
  });
}

async function fetchSharedFixtureMilestoneRows(admin) {
  // 以前このテストが共有フィクスチャとして借用していたのと全く同じクエリ
  // (is_test_account=true, limit 1)で対象プロフィールを特定し、その
  // return_next_day/return_day_7行のスナップショットを取る。
  const { data: sharedProfile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("is_test_account", true)
    .limit(1)
    .maybeSingle();
  if (profileErr) throw new Error(`共有プロフィール取得に失敗: ${profileErr.message}`);
  if (!sharedProfile) return { profileId: null, rows: [] };

  const { data: rows, error: rowsErr } = await admin
    .from("analytics_events")
    .select("id, event_name, is_test_event, occurred_at, properties")
    .eq("user_id", sharedProfile.id)
    .in("event_name", ["return_next_day", "return_day_7"])
    .order("id", { ascending: true });
  if (rowsErr) throw new Error(`共有プロフィールのmilestone行取得に失敗: ${rowsErr.message}`);
  return { profileId: sharedProfile.id, rows: rows ?? [] };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  console.log("\n--- 実行前: 以前の共有フィクスチャプロフィールのmilestone行をスナップショット ---");
  const before = await fetchSharedFixtureMilestoneRows(admin);
  console.log(`対象プロフィール: ${before.profileId ?? "(is_test_account=trueのプロフィールが無い)"}`);
  console.log(`スナップショット行数: ${before.rows.length}`);

  console.log("\n--- test:insert-once-per-user-milestone-eventを2プロセス同時起動 ---");
  const [resultA, resultB] = await Promise.all([runInvocation("A"), runInvocation("B")]);

  for (const result of [resultA, resultB]) {
    if (result.code === 0) {
      ok(`実行${result.label}: 正常終了(exit code 0)`);
    } else {
      bad(`実行${result.label}: 異常終了(exit code ${result.code})\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`);
    }
  }

  console.log("\n--- 実行後: 共有フィクスチャプロフィールのmilestone行が不変であることを確認 ---");
  const after = await fetchSharedFixtureMilestoneRows(admin);
  if (after.profileId !== before.profileId) {
    bad(`共有フィクスチャ対象プロフィール自体が実行前後で変わった(${before.profileId} → ${after.profileId})`);
  } else if (JSON.stringify(before.rows) === JSON.stringify(after.rows)) {
    ok(`共有フィクスチャプロフィールのmilestone行(${after.rows.length}件)が並行実行の前後で完全に不変(バイト単位で一致)`);
  } else {
    bad(
      `共有フィクスチャプロフィールのmilestone行が並行実行によって変化した(並行実行が使い捨てフィクスチャに移行した意味が無い): ` +
        `before=${JSON.stringify(before.rows)} / after=${JSON.stringify(after.rows)}`,
    );
  }

  console.log("\n--- 両実行が作った使い捨てユーザーが残っていないことを確認 ---");
  const { data: residualProfiles, error: residualErr } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "test+milestone-%");
  if (residualErr) {
    bad(`残留プロフィール確認クエリに失敗: ${residualErr.message}`);
  } else if ((residualProfiles ?? []).length === 0) {
    ok("並行実行が作った使い捨てユーザー(test+milestone-*)は1件も残っていない");
  } else {
    bad(
      `並行実行後に使い捨てユーザーが残留している(${residualProfiles.length}件、cleanup漏れ): ` +
        JSON.stringify(residualProfiles),
    );
  }

  console.log(fail
    ? `\n=== test:milestone-fixture-concurrency: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:milestone-fixture-concurrency RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("test-milestone-fixture-concurrency crashed:", e);
  process.exit(1);
});
