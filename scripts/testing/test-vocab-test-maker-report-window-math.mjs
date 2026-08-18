/**
 * scripts/reporting/lib/windowMath.mjs の単体テスト(DBアクセスなし、決定論的)。
 * 使い方: node scripts/testing/test-vocab-test-maker-report-window-math.mjs
 */
import { compute24hWindow, computeReportWindows, computeRate, addDaysToDateStr } from "../reporting/lib/windowMath.mjs";
import { CAMPAIGN_WINDOW_ANCHOR_JST } from "../reporting/vocab-test-maker-7day-check.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(msg);
  else fail(`${msg} (期待=${JSON.stringify(expected)}, 実際=${JSON.stringify(actual)})`);
}

// ---- compute24hWindow ----
{
  const { startISO, endISO } = compute24hWindow("2026-08-18T10:00:00.000Z");
  eq(startISO, "2026-08-18T10:00:00.000Z", "compute24hWindow: startISOは入力をそのまま正規化する");
  eq(endISO, "2026-08-19T10:00:00.000Z", "compute24hWindow: endISOはstartISOの24時間後");
}
{
  let threw = false;
  try { compute24hWindow("not-a-date"); } catch { threw = true; }
  if (threw) ok("compute24hWindow: 不正なISO文字列は例外を投げる");
  else fail("compute24hWindow: 不正なISO文字列でも例外を投げなかった");
}

// ---- addDaysToDateStr ----
eq(addDaysToDateStr("2026-08-25", 7), "2026-09-01", "addDaysToDateStr: +7日で月をまたぐ");
eq(addDaysToDateStr("2026-08-25", -1), "2026-08-24", "addDaysToDateStr: 負の日数で1日戻る");
eq(addDaysToDateStr("2026-08-25", 0), "2026-08-25", "addDaysToDateStr: +0日は変化なし");

// ---- computeReportWindows ----
const ANCHOR = "2026-08-25";
{
  const r = computeReportWindows(ANCHOR, "2026-08-24");
  eq(r, { hasCompleteWindow: false, current: null, prior: null }, "computeReportWindows: today<anchorなら完全なウィンドウ無し");
}
{
  const r = computeReportWindows(ANCHOR, ANCHOR);
  eq(r, { hasCompleteWindow: false, current: null, prior: null }, "computeReportWindows: today=anchor(0日経過)なら完全なウィンドウ無し");
}
{
  // anchor+6日目(ウィンドウ0の最終日、まだ進行中)
  const r = computeReportWindows(ANCHOR, "2026-08-31");
  eq(r, { hasCompleteWindow: false, current: null, prior: null }, "computeReportWindows: ウィンドウ0の最終日がまだ今日(進行中)なら完全なウィンドウ無し(進行中のウィンドウを断定しない)");
}
{
  // anchor+7日目、ウィンドウ0([08-25,08-31])がちょうど完了した翌日
  const r = computeReportWindows(ANCHOR, "2026-09-01");
  eq(
    r,
    { hasCompleteWindow: true, current: { index: 0, startDateStr: "2026-08-25", endDateStrInclusive: "2026-08-31" }, prior: null },
    "computeReportWindows: today=anchor+7でウィンドウ0が完了・priorはまだ無い",
  );
}
{
  // anchor+8日目でもウィンドウ0のまま(ウィンドウ1はまだ進行中)
  const r = computeReportWindows(ANCHOR, "2026-09-02");
  eq(
    r.current,
    { index: 0, startDateStr: "2026-08-25", endDateStrInclusive: "2026-08-31" },
    "computeReportWindows: ウィンドウ1が完了するまでcurrentはウィンドウ0のまま",
  );
}
{
  // anchor+14日目、ウィンドウ1([09-01,09-07])が完了、priorはウィンドウ0
  const r = computeReportWindows(ANCHOR, "2026-09-08");
  eq(
    r,
    {
      hasCompleteWindow: true,
      current: { index: 1, startDateStr: "2026-09-01", endDateStrInclusive: "2026-09-07" },
      prior: { index: 0, startDateStr: "2026-08-25", endDateStrInclusive: "2026-08-31" },
    },
    "computeReportWindows: 2つ目の完全なウィンドウではpriorに1つ目のウィンドウが入る(period-over-period比較可能)",
  );
}

// ---- CAMPAIGN_WINDOW_ANCHOR_JST(実際にvocab-test-maker-7day-check.mjsが使う値) ----
// 回帰テスト(Codexレビュー指摘対応、PR #102、12巡目、P1): 起点をロールアウト終盤
// (Instagram投稿予定日)ではなく、実際にX①が投稿されるキャンペーン開始日に
// 揃え、ローンチ週([起点, 起点+7))が最初の完全なウィンドウとして必ず含まれる
// ことを確認する。以前の起点(2026-08-25)だと最初の完全なウィンドウは
// [2026-08-25, 2026-09-01)になり、実際に投稿が行われるローンチ週が
// どのウィンドウにも一切含まれなかった。
{
  eq(CAMPAIGN_WINDOW_ANCHOR_JST, "2026-08-18", "CAMPAIGN_WINDOW_ANCHOR_JST: X①投稿日(キャンペーン開始日)が起点になっている");
}
{
  const r = computeReportWindows(CAMPAIGN_WINDOW_ANCHOR_JST, "2026-08-25");
  eq(
    r,
    { hasCompleteWindow: true, current: { index: 0, startDateStr: "2026-08-18", endDateStrInclusive: "2026-08-24" }, prior: null },
    "CAMPAIGN_WINDOW_ANCHOR_JST: today=2026-08-25(週次タスクの初回実行日)で、実際にX①〜X③が投稿されるローンチ週[08-18,08-24]が最初の完全なウィンドウとして報告される",
  );
}

// ---- computeRate ----
{
  const r = computeRate(3, 5, 10);
  eq(r, { rate: null, insufficientData: true, numerator: 3, denominator: 5, minSample: 10 }, "computeRate: 分母がminSample未満ならinsufficientData=trueでrateはnull");
}
{
  const r = computeRate(5, 20, 10);
  eq(r, { rate: 0.25, insufficientData: false, numerator: 5, denominator: 20, minSample: 10 }, "computeRate: 分母がminSample以上なら正しい比率を返す");
}
{
  const r = computeRate(0, 0, 0);
  eq(r, { rate: null, insufficientData: false, numerator: 0, denominator: 0, minSample: 0 }, "computeRate: minSample=0かつ分母0ならゼロ除算せずrate=nullを返す(insufficientDataではない)");
}
{
  let threw = false;
  try { computeRate(1, -1); } catch { threw = true; }
  if (threw) ok("computeRate: 負の分母は例外を投げる");
  else fail("computeRate: 負の分母でも例外を投げなかった");
}

console.log(failed ? `\n=== test:vocab-test-maker-report-window-math: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-report-window-math RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
