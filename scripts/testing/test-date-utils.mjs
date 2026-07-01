/**
 * 日付ユーティリティ（src/lib/utils/date.ts）の単体テスト。
 *
 * 「連続学習日数（streak）」「学習カレンダーの曜日」の2バグを修正した際に追加。
 * 実装本体（src/lib/utils/date.ts）を直接importして検証するため、実装とテストが
 * 乖離しない（Node 24 は .ts の型ストリップを標準サポートしているため追加設定不要）。
 *
 * 使い方: node scripts/testing/test-date-utils.mjs
 */
import {
  todayJST,
  toJstDateString,
  daysAgoJST,
  jstWeekdayIndex,
  lastNDaysJST,
} from "../../src/lib/utils/date.ts";

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) pass++;
  else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   got:      ${JSON.stringify(actual)}\n   expected: ${JSON.stringify(expected)}`);
  }
  if (ok) console.log(`✅ ${label}`);
}

function assertTrue(cond, label) {
  assertEqual(cond, true, label);
}

// ============================================================
// streak（連続学習日数）に関するテストで使う、dashboard/stats と
// 同じロジックのstreak計算をここでも再現して検証する。
// ============================================================
function simulateStreak(activeDays, base) {
  let streak = 0;
  for (let i = 0; i < 31; i++) {
    const d = daysAgoJST(i, base);
    if (activeDays.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

{
  // todayJST() 自体（引数なし・常に実時刻を使う）の健全性チェック
  const v = todayJST();
  assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(v), "todayJST() は YYYY-MM-DD 形式を返す");
  assertEqual(v, toJstDateString(new Date()), "todayJST() は toJstDateString(new Date()) と一致する");
}

console.log("=== streak（連続学習日数）のテスト ===\n");

{
  // 1) 同じ日に何回学習しても、streakは1日分だけ（＝同じJST日は常に同じ日付キーになる）
  const base = new Date("2026-07-02T12:00:00+09:00");
  const morning = new Date("2026-07-02T00:05:00+09:00");
  const night   = new Date("2026-07-02T23:55:00+09:00");
  assertEqual(daysAgoJST(0, morning), daysAgoJST(0, night), "同日複数学習: 朝5分と夜23:55が同じ日付キーになる");
  assertEqual(daysAgoJST(0, morning), "2026-07-02", "同日複数学習: 日付キーが正しいJST日付");
}

{
  // 2) 昨日も今日も学習していれば継続（streak=2）
  const base = new Date("2026-07-02T10:00:00+09:00");
  const activeDays = new Set([daysAgoJST(1, base), daysAgoJST(0, base)]);
  assertEqual(simulateStreak(activeDays, base), 2, "昨日→今日で継続: streak=2");
}

{
  // 3) 1日空いたら連続はリセット（一昨日は学習・昨日は空白・今日は学習 → streak=1）
  const base = new Date("2026-07-02T10:00:00+09:00");
  const activeDays = new Set([daysAgoJST(2, base), daysAgoJST(0, base)]);
  assertEqual(simulateStreak(activeDays, base), 1, "一昨日→今日(1日空き)でリセット: streak=1（一昨日分は繰り越さない）");
}

{
  // 4) 23:50→翌日00:10 のような境界でも日本時間基準で正しく日付が切り替わる
  const before = new Date("2026-07-01T23:50:00+09:00");
  const after  = new Date("2026-07-02T00:10:00+09:00"); // 20分後、JST日付は変わる
  assertEqual(toJstDateString(before), "2026-07-01", "23:50 JST時点の日付は 07-01");
  assertEqual(toJstDateString(after),  "2026-07-02", "00:10 JST時点(20分後)の日付は 07-02");
  assertTrue(toJstDateString(before) !== toJstDateString(after), "JST日付境界をまたぐと日付が変わる");
  // 参考: 修正前の実装（UTC基準）だと、この20分ではUTC日付が変わらないため
  // 同じ日付になってしまっていた（＝バグの再現）ことを明示的に確認する
  const buggyBefore = before.toISOString().slice(0, 10);
  const buggyAfter  = after.toISOString().slice(0, 10);
  assertEqual(buggyBefore, buggyAfter, "(参考) UTC基準の旧ロジックだとこの境界で日付が変わらない＝旧バグの再現");
}

{
  // 5) UTCではなくAsia/Tokyo基準で判定されている（早朝の典型ケース）
  const t = new Date("2026-07-02T03:00:00+09:00"); // JST 3:00 = UTC 前日18:00
  assertEqual(toJstDateString(t), "2026-07-02", "JST 3:00 の日付は 07-02（JST基準）");
  const naiveUtc = t.toISOString().slice(0, 10);
  assertEqual(naiveUtc, "2026-07-01", "(参考) 同じ時刻をUTCでスライスすると 07-01 になり日付がズレる");
  assertTrue(toJstDateString(t) !== naiveUtc, "JST基準の判定がUTC基準と異なる（＝日付ズレが解消されている）");
}

console.log("\n=== カレンダー（日付と曜日の対応）のテスト ===\n");

{
  // 1) 日付と曜日が一致する（既知のアンカー日付で検証。月またぎ・年またぎを含む）
  //    DAYS_JP = ["日","月","火","水","木","金","土"] のインデックス規約（0=日〜6=土）
  const anchors = [
    ["2024-01-01", 1, "月"], // 2024-01-01は月曜（既知の事実）
    ["2024-02-29", 4, "木"], // うるう日・月またぎ
    ["2025-01-01", 3, "水"], // 年またぎ
    ["2026-06-30", 2, "火"], // 月末
    ["2026-07-01", 3, "水"], // 月初（Jun30→Jul1の月またぎ）
    ["2026-07-02", 4, "木"],
    ["2026-12-31", 4, "木"], // 年末
    ["2027-01-01", 5, "金"], // 年またぎ（週またぎも兼ねる）
  ];
  for (const [dateStr, expectedIdx, expectedLabel] of anchors) {
    assertEqual(jstWeekdayIndex(dateStr), expectedIdx, `${dateStr} の曜日は ${expectedLabel}(index ${expectedIdx})`);
  }
}

{
  // 2) 月初・月末・週またぎでズレない（連続する日付の曜日indexが必ず+1(mod7)になる）
  const days = lastNDaysJST(45, new Date("2026-07-15T12:00:00+09:00")); // 45日あれば月またぎ含む
  let allConsecutive = true;
  for (let i = 1; i < days.length; i++) {
    const prevIdx = jstWeekdayIndex(days[i - 1]);
    const curIdx = jstWeekdayIndex(days[i]);
    if ((prevIdx + 1) % 7 !== curIdx) allConsecutive = false;
  }
  assertTrue(allConsecutive, "45日分（月またぎ含む）で曜日indexが連続して+1(mod7)される");
}

{
  // 3) 今日の表示が正しい（配列の末尾が基準日と一致する）
  const base = new Date("2026-07-02T15:00:00+09:00");
  const days = lastNDaysJST(30, base);
  assertEqual(days[days.length - 1], toJstDateString(base), "lastNDaysJSTの末尾は基準日(today)と一致する");
  assertEqual(days.length, 30, "指定した日数分の配列が生成される");
}

{
  // 4) 日本時間基準で表示される（早朝のカレンダー生成でも当日を正しく含む）
  const earlyMorning = new Date("2026-07-02T02:00:00+09:00"); // JST 2:00 = UTC前日17:00
  const days = lastNDaysJST(7, earlyMorning);
  assertTrue(days.includes("2026-07-02"), "JST 2:00 に生成したカレンダーにも当日(07-02)が含まれる（UTC基準なら含まれない）");
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
