/**
 * Loop Autonomous Improvement System: 測定終了後のImprovement Memory自動反映を検証する。
 * /api/admin/improvements/[id]/action の accept_result アクションが行うのと同じ手順
 * (evaluateBinomialMeasurementで最終判定 → improvement_memoryへinsert)を実際に実行し、
 * - 判定結果(successful/failed/inconclusive)がresultカラムへ正しくマッピングされる
 * - failed判定はreattempt_allowed=falseで記録され、以後checkMemory()が同じpattern_keyへの
 *   再提案をブロックする(「根拠なく同じ施策を再提案しない」の実効性を確認)
 * - inconclusive判定はreattempt_allowed=trueのまま(再測定の余地を残す)
 * ことを確認する。API route自体(Next.jsのHTTPハンドラ)はNode単体では直接importできない
 * (value importを含みTS5097の制約に抵触するため)、ルートが呼んでいるのと同一のロジック
 * (evaluateBinomialMeasurement + improvement_memory insert)をこのテストからも直接実行することで
 * 「測定終了→Memory反映→再提案ブロック」の一連の流れを検証する(test:improvement-memoryの
 * checkMemory単体テストとは異なり、書き込み側の統合を検証する)。
 *
 * 使い方: node scripts/testing/test-improvement-memory-writeback.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { evaluateBinomialMeasurement } from "../../src/lib/improvement/measurement.ts";
import { checkMemory } from "../../src/lib/improvement/memory.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function writeback(admin, { issueId, taskId, patternKey, verdict, reason }) {
  // improvement_memory.result のCHECK制約は ('success','failure','inconclusive','rolled_back') であり、
  // measurement.tsのverdict('failed')とは語形が異なる。ここでのマッピングは
  // /api/admin/improvements/[id]/action の実装(route.ts)と完全に一致させる。
  const { error } = await admin.from("improvement_memory").insert({
    issue_id: issueId,
    task_id: taskId,
    problem_summary: "テスト用: writeback検証",
    result: verdict === "successful" ? "success" : verdict === "failed" ? "failure" : verdict,
    side_effects: null,
    success_reason: verdict === "successful" ? reason : null,
    failure_reason: verdict === "failed" ? reason : null,
    reattempt_allowed: verdict !== "failed",
    next_recommendation: verdict === "inconclusive" ? "サンプルを追加収集後に再測定" : null,
    pattern_key: patternKey,
  });
  if (error) throw new Error(`improvement_memory insert失敗: ${error.message}`);
}

async function main() {
  const admin = getAdminClient();
  const stamp = Date.now();

  // ケース1: 有意に悪化(failed) → reattempt_allowed=falseで記録され、以後ブロックされる
  const failPatternKey = `test:memory_writeback:failed:${stamp}`;
  {
    const stat = evaluateBinomialMeasurement({
      baseline: { numerator: 50, denominator: 1000 },
      result: { numerator: 150, denominator: 1000 },
      direction: "lower_is_better",
    });
    await writeback(admin, { issueId: null, taskId: null, patternKey: failPatternKey, verdict: stat.verdict, reason: stat.reason });

    const { data: row } = await admin.from("improvement_memory").select("result, reattempt_allowed, failure_reason").eq("pattern_key", failPatternKey).maybeSingle();
    if (row?.result === "failure" && row?.reattempt_allowed === false) {
      ok("有意に悪化(failed)した施策は、result='failure'・reattempt_allowed=falseでimprovement_memoryへ記録される");
    } else {
      fail(`failed判定の書き込み内容が想定外: ${JSON.stringify(row)}`);
    }

    const check = await checkMemory(admin, failPatternKey);
    if (check.hasBlockingFailure) ok("書き込み直後、checkMemory()が同じpattern_keyへの再提案を正しくブロックする(統合が機能している)");
    else fail(`checkMemory()がブロックしなかった: ${JSON.stringify(check)}`);
  }

  // ケース2: サンプル不足(inconclusive) → reattempt_allowed=trueのまま、再測定を妨げない
  const inconclusivePatternKey = `test:memory_writeback:inconclusive:${stamp}`;
  {
    const stat = evaluateBinomialMeasurement({
      baseline: { numerator: 1, denominator: 10 },
      result: { numerator: 5, denominator: 10 },
      direction: "higher_is_better",
    });
    await writeback(admin, { issueId: null, taskId: null, patternKey: inconclusivePatternKey, verdict: stat.verdict, reason: stat.reason });

    const check = await checkMemory(admin, inconclusivePatternKey);
    if (!check.hasBlockingFailure && check.note?.includes("再測定")) {
      ok("サンプル不足(inconclusive)の施策はブロックされず、次回推奨(次回への学び)が引き継がれる(再挑戦の余地を残す)");
    } else {
      fail(`inconclusive判定の扱いが想定外: ${JSON.stringify(check)}`);
    }
  }

  // ケース3: 有意に改善(successful) → 同じ施策の再提案は禁止する理由が無いため、ブロックしない
  const successPatternKey = `test:memory_writeback:successful:${stamp}`;
  {
    const stat = evaluateBinomialMeasurement({
      baseline: { numerator: 100, denominator: 1000 },
      result: { numerator: 40, denominator: 1000 },
      direction: "lower_is_better",
    });
    await writeback(admin, { issueId: null, taskId: null, patternKey: successPatternKey, verdict: stat.verdict, reason: stat.reason });

    const { data: row } = await admin.from("improvement_memory").select("result, success_reason").eq("pattern_key", successPatternKey).maybeSingle();
    if (row?.result === "success" && row?.success_reason) ok("有意に改善(successful)した施策は、result='success'・success_reasonつきで記録される");
    else fail(`successful判定の書き込み内容が想定外: ${JSON.stringify(row)}`);
  }

  await admin.from("improvement_memory").delete().in("pattern_key", [failPatternKey, inconclusivePatternKey, successPatternKey]);

  console.log(failed ? `\n=== test:improvement-memory-writeback: ${failed}件失敗 ===` : "\n=== test:improvement-memory-writeback RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-improvement-memory-writeback crashed:", e);
  process.exit(1);
});
