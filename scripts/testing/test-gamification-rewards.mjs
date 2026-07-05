/**
 * 「今日の達成チケット」判定ロジック（src/lib/gamification/rewardTickets.ts）の単体テスト。
 *
 * ゲーミフィケーション×リワードチケット連携の実装時に追加。ダッシュボードのSSR描画時に
 * DBへ書き込むのは二重付与のリスクがあるため見送り（詳細はWORK_HISTORY.md参照）、代わりに
 * 判定ロジックを純粋関数として切り出し、ここで閾値・進捗表示・次の達成ヒントを検証する。
 * 実装本体を直接importして検証するため、実装とテストが乖離しない
 * （Node 24 は .ts の型ストリップを標準サポートしているため追加設定不要）。
 *
 * 使い方: node scripts/testing/test-gamification-rewards.mjs
 */
import { computeTodayTickets, nextTodayTicket } from "../../src/lib/gamification/rewardTickets.ts";

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`✅ ${label}`); }
  else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   got:      ${JSON.stringify(actual)}\n   expected: ${JSON.stringify(expected)}`);
  }
}

function assertTrue(cond, label) {
  assertEqual(cond, true, label);
}

// ============================================================
// 1. 0語・0学習ユーザー: 4件すべて未達成、崩れないこと
// ============================================================
{
  const tickets = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 0, weakReviewedToday: 0 });
  assertEqual(tickets.length, 4, "0語ユーザー: チケットが4件生成される");
  assertTrue(tickets.every((t) => !t.done), "0語ユーザー: すべて未達成");
  const next = nextTodayTicket(tickets);
  assertEqual(next?.key, "goal", "0語ユーザー: 次の達成ヒントは「今日の学習達成」");
  assertEqual(next.target - next.current, 20, "0語ユーザー: 残り20語と算出される");
}

// ============================================================
// 2. 今日の学習達成のみ（studied=dailyGoal、10語以上なのでreview10も同時達成）
// ============================================================
{
  const tickets = computeTodayTickets({ studied: 20, dailyGoal: 20, streak: 0, weakReviewedToday: 0 });
  const goal = tickets.find((t) => t.key === "goal");
  const review10 = tickets.find((t) => t.key === "review10");
  assertTrue(goal.done, "studied=20/dailyGoal=20: 今日の学習達成チケットが達成扱い");
  assertTrue(review10.done, "studied=20: 復習10語達成チケットも同時に達成扱い（10語以上のため）");
  const next = nextTodayTicket(tickets);
  assertEqual(next?.key, "weak", "goal/review10達成済み時: 次のヒントは「苦手単語を復習」");
}

// ============================================================
// 3. 復習10語達成のみ（studied=10, dailyGoal=20なので今日の学習達成は未達）
// ============================================================
{
  const tickets = computeTodayTickets({ studied: 10, dailyGoal: 20, streak: 0, weakReviewedToday: 0 });
  const goal = tickets.find((t) => t.key === "goal");
  const review10 = tickets.find((t) => t.key === "review10");
  assertTrue(!goal.done, "studied=10/dailyGoal=20: 今日の学習達成は未達");
  assertTrue(review10.done, "studied=10: 復習10語達成は達成扱い");
}

// ============================================================
// 4. 苦手単語復習ボーナス（weakReviewedToday>=1で達成）
// ============================================================
{
  const notYet = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 0, weakReviewedToday: 0 }).find((t) => t.key === "weak");
  const done = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 0, weakReviewedToday: 1 }).find((t) => t.key === "weak");
  assertTrue(!notYet.done, "weakReviewedToday=0: 苦手単語復習は未達");
  assertTrue(done.done, "weakReviewedToday=1: 苦手単語復習は達成扱い（1語で十分）");
}

// ============================================================
// 5. 7日連続達成ボーナス
// ============================================================
{
  const six = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 6, weakReviewedToday: 0 }).find((t) => t.key === "streak7");
  const seven = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 7, weakReviewedToday: 0 }).find((t) => t.key === "streak7");
  const thirty = computeTodayTickets({ studied: 0, dailyGoal: 20, streak: 30, weakReviewedToday: 0 }).find((t) => t.key === "streak7");
  assertTrue(!six.done, "streak=6: 7日連続達成は未達");
  assertTrue(seven.done, "streak=7: 7日連続達成");
  assertTrue(thirty.done, "streak=30: 7日連続達成（超過してもdone=true）");
  assertEqual(thirty.current, 7, "streak=30: current値は上限7でクランプされる（進捗バーが100%を超えない）");
}

// ============================================================
// 6. 全達成時: nextTodayTicketはnullを返す
// ============================================================
{
  const tickets = computeTodayTickets({ studied: 20, dailyGoal: 20, streak: 7, weakReviewedToday: 1 });
  assertTrue(tickets.every((t) => t.done), "全条件達成: 4件すべて達成扱い");
  assertEqual(nextTodayTicket(tickets), null, "全達成時: 次の達成ヒントはnull");
}

// ============================================================
// 7. 境界値: target到達ちょうど・1つ手前
// ============================================================
{
  const justBelow = computeTodayTickets({ studied: 9, dailyGoal: 20, streak: 0, weakReviewedToday: 0 }).find((t) => t.key === "review10");
  const justAt = computeTodayTickets({ studied: 10, dailyGoal: 20, streak: 0, weakReviewedToday: 0 }).find((t) => t.key === "review10");
  assertTrue(!justBelow.done, "studied=9: 復習10語達成は未達（境界値-1）");
  assertTrue(justAt.done, "studied=10: 復習10語達成（境界値ちょうど）");
}

console.log(`\n=== test:gamification-rewards RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
