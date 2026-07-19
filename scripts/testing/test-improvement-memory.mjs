/**
 * Loop Autonomous Improvement System: checkMemory()の検証(IMPROVEMENT_MEMORY_POLICY.md)。
 * 過去にresult='failure'かつreattempt_allowed=falseの記録があるpattern_keyについて、
 * hasBlockingFailure=trueが返り、同じ失敗施策の再提案を防げることを確認する。
 * テスト用に作成したimprovement_memory行は最後に削除する。
 *
 * 使い方: node scripts/testing/test-improvement-memory.mjs
 */
import { checkMemory } from "../../src/lib/improvement/memory.ts";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const admin = getAdminClient();
  const testPatternKeyFailure = `test:memory_check:failure_${Date.now()}`;
  const testPatternKeyInconclusive = `test:memory_check:inconclusive_${Date.now()}`;
  const insertedIds = [];

  try {
    {
      const noRecord = await checkMemory(admin, `test:memory_check:nonexistent_${Date.now()}`);
      if (!noRecord.hasBlockingFailure && noRecord.note === null) ok("記録が無いpattern_keyはhasBlockingFailure=false・note=null");
      else fail(`記録が無いのに想定外の結果: ${JSON.stringify(noRecord)}`);
    }

    const { data: failureRow, error: e1 } = await admin
      .from("improvement_memory")
      .insert({
        problem_summary: "テスト用: 過去に失敗した施策",
        result: "failure",
        reattempt_allowed: false,
        failure_reason: "テスト用の失敗理由",
        pattern_key: testPatternKeyFailure,
      })
      .select("id")
      .single();
    if (e1) throw new Error(`テストデータ作成失敗: ${e1.message}`);
    insertedIds.push(failureRow.id);

    {
      const blocked = await checkMemory(admin, testPatternKeyFailure);
      if (blocked.hasBlockingFailure && blocked.note?.includes("テスト用の失敗理由")) {
        ok("reattempt_allowed=falseの失敗記録がある場合、hasBlockingFailure=trueになり理由が引き継がれる");
      } else {
        fail(`失敗記録の照合が想定外: ${JSON.stringify(blocked)}`);
      }
    }

    const { data: inconclusiveRow, error: e2 } = await admin
      .from("improvement_memory")
      .insert({
        problem_summary: "テスト用: サンプル不足で結論が出ていない施策",
        result: "inconclusive",
        reattempt_allowed: true,
        next_recommendation: "あと10件サンプルが必要",
        pattern_key: testPatternKeyInconclusive,
      })
      .select("id")
      .single();
    if (e2) throw new Error(`テストデータ作成失敗: ${e2.message}`);
    insertedIds.push(inconclusiveRow.id);

    {
      const inconclusive = await checkMemory(admin, testPatternKeyInconclusive);
      if (!inconclusive.hasBlockingFailure && inconclusive.note?.includes("あと10件サンプルが必要")) {
        ok("inconclusiveな記録はブロックしないが、次回推奨は引き継がれる");
      } else {
        fail(`inconclusiveの扱いが想定外: ${JSON.stringify(inconclusive)}`);
      }
    }
  } finally {
    if (insertedIds.length > 0) {
      await admin.from("improvement_memory").delete().in("id", insertedIds);
      console.log(`(cleanup) テスト用improvement_memory ${insertedIds.length}件を削除した`);
    }
  }

  console.log(failed ? `\n=== test:improvement-memory: ${failed}件失敗 ===` : "\n=== test:improvement-memory RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-improvement-memory crashed:", e);
  process.exit(1);
});
