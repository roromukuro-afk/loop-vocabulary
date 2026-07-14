/**
 * Growth OS: 週次レポート生成ロジックの検証。
 *
 * `resolveLastCompletedWeek()`(JST週境界の純粋関数)を`src/lib/growth/weekBoundary.ts`から
 * 直接importして検証する。`buildWeeklyReport()`本体(DB読み取り)は`@/lib/utils/date`等の
 * Next.js専用エイリアスに依存するためNode直接実行からはimportできない
 * (詳細は`weekBoundary.ts`冒頭コメント参照)。そちらの動作確認は
 * `npm run verify:prod`実行時に`/api/cron/growth-weekly-report`をHTTPで直接呼び出す形で行う。
 *
 * 使い方: node scripts/testing/test-weekly-growth-report.mjs
 */
import { resolveLastCompletedWeek } from "../../src/lib/growth/weekBoundary.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

// ── resolveLastCompletedWeek: 純粋関数のロジック確認 ──
{
  // 2026-07-15は水曜日。今週の月曜(07-13)の前の週=07-06(月)〜07-12(日)が「直近の完了した週」。
  const { weekStart, weekEnd } = resolveLastCompletedWeek("2026-07-15");
  if (weekStart === "2026-07-06" && weekEnd === "2026-07-12") {
    ok(`resolveLastCompletedWeek("2026-07-15") = ${weekStart}〜${weekEnd}（期待どおり）`);
  } else {
    fail(`resolveLastCompletedWeek("2026-07-15") = ${weekStart}〜${weekEnd}（期待: 2026-07-06〜2026-07-12）`);
  }
}
{
  // 月曜日を渡した場合も同じロジックで「先週」が返る
  const { weekStart, weekEnd } = resolveLastCompletedWeek("2026-07-13"); // 月曜
  if (weekStart === "2026-07-06" && weekEnd === "2026-07-12") {
    ok(`月曜日を基準にしても正しく先週が返る (${weekStart}〜${weekEnd})`);
  } else {
    fail(`月曜日基準で誤った週が返った: ${weekStart}〜${weekEnd}`);
  }
}
{
  const r1 = resolveLastCompletedWeek("2026-07-15");
  const diffMs = new Date(`${r1.weekEnd}T00:00:00Z`) - new Date(`${r1.weekStart}T00:00:00Z`);
  if (diffMs === 6 * 24 * 60 * 60 * 1000) ok("週の範囲がちょうど7日間(月曜〜日曜)");
  else fail(`週の範囲が7日間になっていない: ${diffMs}ms`);
}

console.log("ℹ️  buildWeeklyReport()本体のDB統合確認はverify:prod実行時にcronエンドポイント経由で行う(理由は本ファイル冒頭コメント参照)。");

console.log(failed ? `\n=== test:weekly-growth-report: ${failed}件失敗 ===` : "\n=== test:weekly-growth-report RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
