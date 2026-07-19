/**
 * Loop Autonomous Improvement System: computePriorityScore()の単体テスト。
 * 使い方: node scripts/testing/test-priority-scoring.mjs
 */
import { computePriorityScore } from "../../src/lib/improvement/priorityScore.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

{
  const high = computePriorityScore({ reach: 0.9, impact: 0.9, confidence: 0.9, effort: 0.1, risk: 0.1 });
  const low = computePriorityScore({ reach: 0.1, impact: 0.1, confidence: 0.1, effort: 0.9, risk: 0.9 });
  if (high > low) ok(`reach/impact/confidence高・effort/risk低のissueがスコア上位になる (${high} > ${low})`);
  else fail(`優先度の大小関係が逆転している: high=${high}, low=${low}`);
}
{
  const zeroEffort = computePriorityScore({ reach: 0.5, impact: 0.5, confidence: 0.5, effort: 0, risk: 0 });
  if (Number.isFinite(zeroEffort) && zeroEffort > 0) ok(`effort=0でもゼロ除算にならず有限値を返す (${zeroEffort})`);
  else fail(`effort=0で不正な値になった: ${zeroEffort}`);
}
{
  const riskHalf = computePriorityScore({ reach: 1, impact: 1, confidence: 1, effort: 1, risk: 1 });
  // risk=1 の場合、(1 - 1*0.5) = 0.5 倍になるはず(risk*0.5の設計どおり)
  const expected = Math.round(((1 * 1 * 1) / 1) * 0.5 * 1000) / 1000;
  if (riskHalf === expected) ok(`risk=1のとき0.5倍される設計どおりの値 (${riskHalf})`);
  else fail(`risk=1の計算が想定と異なる: 期待=${expected}, 実際=${riskHalf}`);
}
{
  const a = computePriorityScore({ reach: 0.3, impact: 0.4, confidence: 0.5, effort: 0.2, risk: 0.1 });
  const b = computePriorityScore({ reach: 0.3, impact: 0.4, confidence: 0.5, effort: 0.2, risk: 0.1 });
  if (a === b) ok("同じ入力に対して常に同じスコアを返す(決定論的)");
  else fail(`非決定論的な結果になった: ${a} !== ${b}`);
}

console.log(failed ? `\n=== test:priority-scoring: ${failed}件失敗 ===` : "\n=== test:priority-scoring RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
