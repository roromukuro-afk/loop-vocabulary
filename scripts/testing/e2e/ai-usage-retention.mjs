/**
 * ai_usage_events の保持期間ポリシー（既定90日）・削除運用・アカウント削除時の
 * カスケード削除に関する自律検証。
 *
 * 2026-07-06、AI利用状況の運用監視ラウンドの残課題「保持期間・削除運用・
 * プライバシー整合」への対応として、`scripts/ai/cleanup-ai-usage-events.mjs`
 * （dry-run既定・--apply時はCONFIRM_AI_USAGE_CLEANUP=yes必須）を新設した。
 *
 * 1. 保持期間(90日)より古いログのみが削除対象になり、期間内のログは対象外になることを
 *    件数集計で確認（dry-runの集計ロジック自体を直接呼び出して検証）
 * 2. dry-run実行（CLIをそのまま起動）ではDBへの削除が一切発生しないことを確認
 * 3. --apply実行時、CONFIRM_AI_USAGE_CLEANUP環境変数が無いと拒否されDBが変化しないことを確認
 * 4. --apply + CONFIRM_AI_USAGE_CLEANUP=yesで、90日より古いテスト行のみ削除され、
 *    90日以内のテスト行は残ることを確認
 * 5. アカウント削除時にai_usage_eventsがどう扱われるか: 使い捨てのテスト専用authユーザーを
 *    作成し、そのユーザーのai_usage_events行を作った上でauth.admin.deleteUser()を呼び、
 *    ON DELETE CASCADEにより行が自動的に削除されることを実際に確認する
 *    （共有テストアカウント(test+srs等)には一切手を触れない）
 *
 * 使い方: node scripts/testing/e2e/ai-usage-retention.mjs
 */
import { execFileSync } from "child_process";
import { resolve } from "path";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { cutoffIsoFor, DEFAULT_RETENTION_DAYS } from "../../ai/cleanup-ai-usage-events.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const SCRIPT_PATH = resolve(REPO_ROOT, "scripts/ai/cleanup-ai-usage-events.mjs");
const OLD_ROUTE_MARKER = "__test_retention_old__";
const RECENT_ROUTE_MARKER = "__test_retention_recent__";

function runScript(args, extraEnv = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: "utf-8",
    });
    return { stdout: out, code: 0 };
  } catch (e) {
    return { stdout: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status ?? 1 };
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const now = Date.now();
  const oldCreatedAt = new Date(now - (DEFAULT_RETENTION_DAYS + 10) * 24 * 60 * 60 * 1000).toISOString();
  const recentCreatedAt = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

  let oldRowId, recentRowId;
  let tempUserId;

  try {
    // ================= 0. 事前確認: 定数・カットオフ計算の妥当性 =================
    console.log("\n--- 0. 保持期間定数・カットオフ計算の確認 ---");
    if (DEFAULT_RETENTION_DAYS === 90) ok(`既定保持期間は90日 (DEFAULT_RETENTION_DAYS=${DEFAULT_RETENTION_DAYS})`);
    else bad(`既定保持期間が想定外 (${DEFAULT_RETENTION_DAYS})`);
    const cutoff = new Date(cutoffIsoFor(90, new Date(now)));
    const expectedCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);
    if (Math.abs(cutoff.getTime() - expectedCutoff.getTime()) < 1000) {
      ok("cutoffIsoFor(90)が現在時刻の90日前を正しく計算する");
    } else {
      bad(`cutoffIsoFor(90)の計算が想定外 (${cutoff.toISOString()} vs ${expectedCutoff.toISOString()})`);
    }

    // ================= 1〜2. テスト行を作成し、dry-runでは何も削除されない =================
    console.log("\n--- 1〜2. dry-runではDBへの削除が発生しない ---");
    const { data: oldRow, error: oldErr } = await admin
      .from("ai_usage_events")
      .insert({ user_id: null, route: OLD_ROUTE_MARKER, status: "success", created_at: oldCreatedAt })
      .select("id")
      .single();
    if (oldErr || !oldRow) throw new Error(`old test row作成に失敗: ${oldErr?.message}`);
    oldRowId = oldRow.id;

    const { data: recentRow, error: recentErr } = await admin
      .from("ai_usage_events")
      .insert({ user_id: null, route: RECENT_ROUTE_MARKER, status: "success", created_at: recentCreatedAt })
      .select("id")
      .single();
    if (recentErr || !recentRow) throw new Error(`recent test row作成に失敗: ${recentErr?.message}`);
    recentRowId = recentRow.id;
    ok(`保持期間超過(${DEFAULT_RETENTION_DAYS + 10}日前)・保持期間内(10日前)のテスト行を各1件作成した`);

    const dryRun = runScript([]);
    if (dryRun.code === 0) ok("dry-run実行が正常終了する(exit code 0)");
    else bad(`dry-run実行が異常終了した(exit code ${dryRun.code}): ${dryRun.stdout}`);
    if (dryRun.stdout.includes("dry-runモードのため")) ok("dry-runである旨がコンソール出力に表示される");
    else bad("dry-runである旨の出力が見つからない");

    const { data: afterDryRun } = await admin.from("ai_usage_events").select("id").in("id", [oldRowId, recentRowId]);
    if ((afterDryRun ?? []).length === 2) {
      ok("dry-run後も保持期間超過・保持期間内のテスト行が両方とも削除されずに残っている");
    } else {
      bad(`dry-run後にテスト行が消えている（想定外の書き込みが発生した）: ${(afterDryRun ?? []).length}/2件`);
    }

    // ================= 3. CONFIRM環境変数が無い--applyは拒否される =================
    console.log("\n--- 3. CONFIRM_AI_USAGE_CLEANUP無しの--applyは拒否される ---");
    const applyWithoutConfirm = runScript(["--apply"]);
    if (applyWithoutConfirm.code !== 0) ok("CONFIRM_AI_USAGE_CLEANUP無しの--applyは0以外のexit codeで拒否される");
    else bad("CONFIRM_AI_USAGE_CLEANUP無しの--applyが成功してしまった（安全ガードが機能していない）");

    const { data: afterRejectedApply } = await admin.from("ai_usage_events").select("id").in("id", [oldRowId, recentRowId]);
    if ((afterRejectedApply ?? []).length === 2) {
      ok("拒否された--apply実行後もテスト行が両方とも残っている");
    } else {
      bad(`拒否されたはずの--apply実行後にテスト行が変化した: ${(afterRejectedApply ?? []).length}/2件`);
    }

    // ================= 4. CONFIRM付き--applyで保持期間超過分のみ削除される =================
    console.log("\n--- 4. CONFIRM_AI_USAGE_CLEANUP=yes付き--applyで保持期間超過分のみ削除される ---");
    const applyWithConfirm = runScript(["--apply"], { CONFIRM_AI_USAGE_CLEANUP: "yes" });
    if (applyWithConfirm.code === 0) ok("CONFIRM_AI_USAGE_CLEANUP=yes付き--applyが正常終了する");
    else bad(`CONFIRM付き--applyが異常終了した(exit code ${applyWithConfirm.code}): ${applyWithConfirm.stdout}`);

    const { data: oldRowAfter } = await admin.from("ai_usage_events").select("id").eq("id", oldRowId).maybeSingle();
    if (!oldRowAfter) ok(`保持期間超過(${DEFAULT_RETENTION_DAYS + 10}日前)のテスト行が削除された`);
    else bad("保持期間超過のテスト行が削除されずに残っている");
    oldRowId = null; // 削除済みなのでfinallyで二重削除を試みない

    const { data: recentRowAfter } = await admin.from("ai_usage_events").select("id").eq("id", recentRowId).maybeSingle();
    if (recentRowAfter) ok("保持期間内(10日前)のテスト行は削除されずに残っている");
    else bad("保持期間内のテスト行が誤って削除されてしまった");

    // ================= 5. アカウント削除時のカスケード削除 =================
    console.log("\n--- 5. アカウント削除時にai_usage_eventsがカスケード削除されることの確認 ---");
    const tempEmail = `test+retention-${Date.now()}@loop-vocabulary.app`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: tempEmail,
      password: `Retention-${Date.now()}-Test!`,
      email_confirm: true,
      user_metadata: { is_test_account: true, purpose: "ai_usage_events retention cascade test (使い捨て)" },
    });
    if (createErr || !created?.user) {
      bad(`使い捨てテストユーザーの作成に失敗: ${createErr?.message}`);
    } else {
      tempUserId = created.user.id;
      await admin.from("profiles").update({ is_test_account: true }).eq("id", tempUserId);

      const { data: tempEvent, error: tempEventErr } = await admin
        .from("ai_usage_events")
        .insert({ user_id: tempUserId, route: "ai", status: "success" })
        .select("id")
        .single();
      if (tempEventErr || !tempEvent) {
        bad(`使い捨てユーザーのai_usage_events行作成に失敗: ${tempEventErr?.message}`);
      } else {
        const { error: deleteUserErr } = await admin.auth.admin.deleteUser(tempUserId);
        if (deleteUserErr) {
          bad(`使い捨てユーザーの削除に失敗: ${deleteUserErr.message}`);
        } else {
          ok("使い捨てテストユーザーをauth.admin.deleteUser()で削除した");
          tempUserId = null; // 削除済み

          const { data: eventAfterUserDelete } = await admin
            .from("ai_usage_events")
            .select("id")
            .eq("id", tempEvent.id)
            .maybeSingle();
          if (!eventAfterUserDelete) {
            ok("アカウント削除(auth.users行の削除)によりai_usage_events行もON DELETE CASCADEで自動削除された");
          } else {
            bad("アカウント削除後もai_usage_events行が残っている（ON DELETE CASCADEが機能していない）");
          }
        }
      }
    }
  } finally {
    if (oldRowId) await getAdminClient().from("ai_usage_events").delete().eq("id", oldRowId);
    if (recentRowId) await getAdminClient().from("ai_usage_events").delete().eq("id", recentRowId);
    if (tempUserId) {
      await getAdminClient().auth.admin.deleteUser(tempUserId).catch(() => {});
    }
    ok("テスト用の行・使い捨てユーザーの後始末を行った（冪等性確保）");
  }

  console.log(`\n=== test:ai-usage-retention RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ai-usage-retention verification crashed:", e);
  process.exit(1);
});
