/**
 * Growth OS: 収益指標の純粋関数ロジックを検証する（DBアクセス無し）。
 * `src/lib/growth/revenueSnapshot.ts` のプラン価格・新規契約/解約ヒューリスティック・
 * AIコスト概算のロジックが仕様どおりかを確認する。
 *
 * 使い方: node scripts/testing/test-revenue-metrics.mjs
 */
import {
  computeSubscriptionLifecycleCounts,
  computeMrrArr,
  estimateAiCostJpy,
  MONTHLY_PRICE_JPY,
  YEARLY_PRICE_JPY,
} from "../../src/lib/growth/revenueSnapshot.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function assertEqual(actual, expected, msg) {
  if (actual === expected) ok(msg);
  else fail(`${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

// ── 価格が実際の表示価格(¥480/月・¥3,800/年)と一致しているか ──
assertEqual(MONTHLY_PRICE_JPY, 480, "月額価格定数が¥480");
assertEqual(YEARLY_PRICE_JPY, 3800, "年額価格定数が¥3,800");

// ── MRR/ARR計算 ──
{
  const { mrr, arr } = computeMrrArr(10, 5);
  // computeMrrArr は「丸め前のmrrを12倍してから丸める」実装のため、期待値もこの順序で計算する
  // (mrrを先に丸めてから12倍すると、丸め誤差の蓄積で一致しないことがある)。
  const unroundedMrr = 10 * 480 + 5 * (3800 / 12);
  assertEqual(mrr, Math.round(unroundedMrr), "MRR計算(月額10件+年額5件)");
  assertEqual(arr, Math.round(unroundedMrr * 12), "ARR計算(丸め前のMRR×12を丸める)");
}
{
  const { mrr, arr } = computeMrrArr(0, 0);
  assertEqual(mrr, 0, "契約0件ならMRRは0");
  assertEqual(arr, 0, "契約0件ならARRは0");
}

// ── 新規契約/解約ヒューリスティック ──
{
  const today = "2026-07-10";
  const profiles = [
    // 新規契約: is_premium=true, expires_at=null, 当日updated_at
    { id: "u1", is_premium: true, stripe_customer_id: "cus_1", premium_expires_at: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-10T05:00:00+09:00" },
    // 解約: is_premium=false, stripe_customer_idあり, 当日updated_at
    { id: "u2", is_premium: false, stripe_customer_id: "cus_2", premium_expires_at: null, created_at: "2026-06-01T00:00:00Z", updated_at: "2026-07-10T10:00:00+09:00" },
    // 対象日と無関係(前日更新)
    { id: "u3", is_premium: true, stripe_customer_id: "cus_3", premium_expires_at: null, created_at: "2026-06-15T00:00:00Z", updated_at: "2026-07-09T10:00:00+09:00" },
    // 解約予約中(is_premium=trueのままexpires_atがセットされている)は新規契約にカウントしない
    { id: "u4", is_premium: true, stripe_customer_id: "cus_4", premium_expires_at: "2026-08-01T00:00:00Z", updated_at: "2026-07-10T12:00:00+09:00" },
    // stripe_customer_idが無いユーザーの解約は対象外(元々Stripe顧客ではない)
    { id: "u5", is_premium: false, stripe_customer_id: null, premium_expires_at: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-10T12:00:00+09:00" },
  ];
  const result = computeSubscriptionLifecycleCounts(profiles, today);
  assertEqual(result.newSubscriptions, 1, "新規契約は1件(u1のみ、u4は解約予約中のため除外)");
  assertEqual(result.cancellations, 1, "解約は1件(u2のみ、u5はstripe_customer_id無しのため除外)");
  assertEqual(result.reactivations, 0, "reactivationsは既知の制約により常に0");
}
{
  // JST日付境界: 前日23:59 JST(=UTC 14:59)は対象日に含まれない
  const profiles = [
    { id: "u6", is_premium: true, stripe_customer_id: "cus_6", premium_expires_at: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-09T14:59:00.000Z" },
  ];
  const result = computeSubscriptionLifecycleCounts(profiles, "2026-07-10");
  assertEqual(result.newSubscriptions, 0, "JST日付境界外(前日23:59 JST)は対象日にカウントされない");
}

// ── AIコスト概算 ──
{
  const cost = estimateAiCostJpy([{ input_size: 1000, output_size: 1000 }]);
  if (cost > 0) ok("AI利用があればコスト概算は正の値になる");
  else fail(`AI利用があるのにコスト概算が0以下: ${cost}`);
}
{
  const cost = estimateAiCostJpy([]);
  assertEqual(cost, 0, "AI利用が無ければコスト概算は0");
}

console.log(failed ? `\n=== test:revenue-metrics: ${failed}件失敗 ===` : "\n=== test:revenue-metrics RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
