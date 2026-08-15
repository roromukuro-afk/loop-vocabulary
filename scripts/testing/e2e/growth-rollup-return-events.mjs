/**
 * Growth OS: return_next_day / return_day_7 サーバー計測イベントの正しさ・冪等性の自律検証。
 *
 * computeReturnEvents(src/lib/analytics/rollup.ts)は、非テストユーザーについて
 * targetDate = signupDate(JST, profiles.created_at) + offset日 が今日(JST)以前で、
 * かつ その日の daily_stats.studied_count > 0 の行があれば「返ってきた」とみなし、
 * analytics_events に return_next_day(offset=1) / return_day_7(offset=7) を
 * ユーザーごとに生涯1回だけ発火する(cronは直近7日ローリングで毎日再実行されるため、
 * 一度条件を満たしたユーザーは翌日以降も条件を満たし続け、素朴に毎回発火すると
 * 重複してしまう。これを防ぐ冪等性の検証が本テストの主眼)。
 *
 * 【Issue #95対応後の重要な前提】computeReturnEvents()が処理対象にするのは
 * is_test_account=falseの実ユーザーのみ(テストアカウントは元々このpipelineの対象外)。
 * insertOncePerUserMilestoneEvent()は今回の修正で、非production環境では対象userIdが
 * is_test_account=trueでない限り一切INSERTしない(本番の一意性キーを予約しないため)。
 * つまりこのテストをローカル/CI(非production)で実行する限り、growth-rollup cronは
 * 実ユーザーのreturn_next_day/return_day_7行を「新規に1件も作らない」のが正しい挙動になる
 * (以前は非production実行でも実ユーザー分をis_test_event=trueとして直接INSERTしており、
 * それ自体が本番の一意制約キーを先取りしてしまう欠陥だった)。
 *
 * 検証内容:
 *  1. profiles + daily_stats から独立に「条件を満たすはずのユーザー」を計算する
 *     (computeRetentionCohortsの検証である retention-source-of-truth.mjs と同じ
 *     独立計算スタイル。参考情報としてログ出力するのみで、行の存在は要求しない)。
 *  2. /api/cron/growth-rollup を1回実行しても、非production環境では新規発火が常に0件
 *     (return_next_day_fired=0, return_day_7_fired=0)であり、analytics_eventsの
 *     return_next_day/return_day_7行が実行前後で1件も増えないことを確認する
 *     (=本番の一意性キーを消費していないことの直接証拠)。
 *  3. 同じユーザー×イベントの組み合わせが重複行を持たない(ちょうど1行)ことを確認する。
 *  4. 2回目のcron実行でも新規発火が0件のままで、analytics_eventsの行数・内訳も
 *     一切変化しない(=冪等)ことを確認する。
 *
 * 使い方: node scripts/testing/e2e/growth-rollup-return-events.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function toJstDateString(d) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function jstDatePlusDays(dateStr, offset) {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return toJstDateString(d);
}

const RETURN_EVENT_DEFS = [
  { offset: 1, eventName: "return_next_day" },
  { offset: 7, eventName: "return_day_7" },
];

async function computeExpectedQualifyingUsers(admin) {
  const [{ data: profiles, error: profErr }, { data: dsRows, error: dsErr }] = await Promise.all([
    admin.from("profiles").select("id, created_at, is_test_account"),
    admin.from("daily_stats").select("user_id, day, studied_count").gt("studied_count", 0),
  ]);
  if (profErr) throw new Error(profErr.message);
  if (dsErr) throw new Error(dsErr.message);

  const activeUserDay = new Set((dsRows ?? []).map((r) => `${r.user_id}|${r.day}`));
  const today = toJstDateString(new Date());

  const qualifying = { return_next_day: new Set(), return_day_7: new Set() };
  for (const p of (profiles ?? []).filter((p) => !p.is_test_account)) {
    const signupDate = toJstDateString(new Date(p.created_at));
    for (const { offset, eventName } of RETURN_EVENT_DEFS) {
      const targetDate = jstDatePlusDays(signupDate, offset);
      if (targetDate > today) continue; // 未到達 → 分母に入れない
      if (activeUserDay.has(`${p.id}|${targetDate}`)) qualifying[eventName].add(p.id);
    }
  }
  return qualifying;
}

async function fetchReturnEventRows(admin) {
  const { data, error } = await admin
    .from("analytics_events")
    .select("event_name, user_id, is_test_event")
    .in("event_name", ["return_next_day", "return_day_7"]);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// このテスト自身の実行(=このプロセスが叩いたcron呼び出し)で新規に発火した行だけを
// 対象にする。return_next_day/return_day_7は生涯1回だけの仕様上、過去(本番の実運用や
// このテストの過去回実行)で既に発火済みのユーザーの行はこのテスト実行中には一切
// 増減しないため、それらを含めてis_test_eventを検証すると過去の(このテストが
// 修正される前の)行や本当のProduction cronが作った行まで誤ってFAILと判定してしまう。
async function fetchReturnEventRowsSince(admin, sinceISO) {
  const { data, error } = await admin
    .from("analytics_events")
    .select("event_name, user_id, is_test_event")
    .in("event_name", ["return_next_day", "return_day_7"])
    .gte("occurred_at", sinceISO);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function countByUserEvent(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.event_name}|${row.user_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function main() {
  loadEnv();
  requireEnv(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();
  const testRunStartedAt = new Date().toISOString();

  // このテストの前提(実ユーザー分のINSERTが常に0件になること)は、サーバーが
  // 非production環境として起動していることに依存する。opts.envを渡さずにensureServer()を
  // 呼ぶと、既にこのポートで動いている(親プロセスのVERCEL_ENVを継承した)production
  // 相当のサーバーをそのまま再利用してしまい得る。その場合、下の新規発火0件assertionが
  // 落ちる前に、実ユーザーの本番D1/D7一意性キーへ本当にINSERTしてしまう(発生後は
  // このIssueの制約上DELETEで取り消せない)。VERCEL_ENV=previewを明示的に注入することで
  // 必ず非production環境で起動させ、既にこのポートが(検証できない環境の)別プロセスで
  // 占有されている場合はensureServer()側の保護(Issue #95対応)でエラーにする
  // (Codexレビュー指摘対応)。
  const dev = await ensureServer(PORT, { env: { VERCEL_ENV: "preview" } });
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    console.log("\n--- 独立にprofiles+daily_statsから「返ってきたはず」のユーザーを計算する(参考情報) ---");
    const expected = await computeExpectedQualifyingUsers(admin);
    console.log(`expected return_next_day qualifying users: ${expected.return_next_day.size}`);
    console.log(`expected return_day_7 qualifying users: ${expected.return_day_7.size}`);
    console.log("ℹ️  これらは実ユーザー(is_test_account=false)のみ。computeReturnEvents()自体が" +
      "元々テストアカウントを対象外にしており、かつ今回のIssue #95修正により非production環境では" +
      "実ユーザー分のINSERTも一切行わなくなったため、以下では『行が存在するはず』ではなく" +
      "『新規に行が増えないはず』を検証する。");

    const rowsBeforeRun1 = await fetchReturnEventRows(admin);

    console.log("\n--- growth-rollup cronを1回目実行 ---");
    const res1 = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body1 = await res1.json().catch((e) => ({ parseError: String(e) }));
    if (res1.status === 200 && body1?.ok === true) ok("1回目のcron実行が正常完了した");
    else bad(`1回目のcron実行が失敗: status=${res1.status} body=${JSON.stringify(body1)}`);

    if (body1?.computed?.return_events) ok("computed.return_events が返っている");
    else bad(`computed.return_events が欠けている: ${JSON.stringify(body1)}`);
    console.log("return_events detail:", JSON.stringify(body1?.computed?.return_events));

    const detail1 = body1?.computed?.return_events;
    if (detail1 && detail1.return_next_day_fired === 0 && detail1.return_day_7_fired === 0) {
      ok("非production環境での1回目実行: 新規発火が0件(return_next_day_fired=0, return_day_7_fired=0)" +
        "(=実ユーザー分は本番の一意性キーを予約せずスキップされている)");
    } else {
      bad(`非production環境なのに新規発火が発生した(本番の一意性キーを予約してしまっている可能性): ${JSON.stringify(detail1)}`);
    }

    console.log("\n--- analytics_eventsのreturn_next_day/return_day_7行が実行前後で増えていないか確認 ---");
    const rowsAfterRun1 = await fetchReturnEventRows(admin);
    if (rowsAfterRun1.length === rowsBeforeRun1.length) {
      ok(`1回目実行の前後でreturn_next_day/return_day_7の総行数が変化していない(${rowsAfterRun1.length}件のまま)`);
    } else {
      bad(`1回目実行でreturn_next_day/return_day_7の行数が変化した (${rowsBeforeRun1.length} -> ${rowsAfterRun1.length})`);
    }

    const countsAfterRun1 = countByUserEvent(rowsAfterRun1);
    let dupFound = false;
    for (const [key, count] of countsAfterRun1) {
      if (count > 1) { dupFound = true; bad(`${key}: 1回目実行時点で既に${count}件の重複行がある`); }
    }
    if (!dupFound) ok("1回目実行時点で(event_name,user_id)ペアの重複行は無い");

    // 上記の「新規発火0件・行数不変」により、このテスト実行が本番の一意性キーを
    // 一切消費していないことは既に確認済み。念のため、このテスト開始時刻以降に
    // 新規挿入された行が本当に1件もないことも直接確認する(is_test_event=trueの
    // 行であっても、computeReturnEvents()の対象は実ユーザーのみのため今回は
    // 0件が正しい)。
    const newlyFiredRows = await fetchReturnEventRowsSince(admin, testRunStartedAt);
    if (newlyFiredRows.length === 0) {
      ok("このテスト実行開始以降、return_next_day/return_day_7の新規行が1件も作られていない");
    } else {
      bad(`このテスト実行中に想定外の新規行が${newlyFiredRows.length}件作られた(本番集計を汚染しうる): ${JSON.stringify(newlyFiredRows.slice(0, 5))}`);
    }

    console.log("\n--- growth-rollup cronを2回目実行(冪等性チェック) ---");
    const res2 = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body2 = await res2.json().catch((e) => ({ parseError: String(e) }));
    if (res2.status === 200 && body2?.ok === true) ok("2回目のcron実行も正常完了した");
    else bad(`2回目のcron実行が失敗: status=${res2.status} body=${JSON.stringify(body2)}`);

    const detail2 = body2?.computed?.return_events;
    if (detail2 && detail2.return_next_day_fired === 0 && detail2.return_day_7_fired === 0) {
      ok("2回目実行では新規発火が0件(return_next_day_fired=0, return_day_7_fired=0)");
    } else {
      bad(`2回目実行で想定外の新規発火があった: ${JSON.stringify(detail2)}`);
    }

    const rowsAfterRun2 = await fetchReturnEventRows(admin);
    const countsAfterRun2 = countByUserEvent(rowsAfterRun2);
    let mismatch = false;
    for (const [key, countBefore] of countsAfterRun1) {
      const countAfter = countsAfterRun2.get(key) ?? 0;
      if (countAfter !== countBefore) {
        mismatch = true;
        bad(`${key}: 2回目実行後に行数が変化した (${countBefore} -> ${countAfter})`);
      }
    }
    if (rowsAfterRun1.length !== rowsAfterRun2.length) {
      mismatch = true;
      bad(`return_next_day/return_day_7の総行数が2回目実行で変化した (${rowsAfterRun1.length} -> ${rowsAfterRun2.length})`);
    }
    if (!mismatch) ok(`2回目実行後もanalytics_eventsの行数(${rowsAfterRun2.length}件)・内訳が変化していない(冪等)`);

    console.log("\n--- growth-rollup cronを2つ同時実行(並行実行での重複防止チェック) ---");
    // insertOncePerUserMilestoneEvent()はDB側の部分ユニークインデックス+
    // Postgres関数のON CONFLICT DO NOTHINGで原子性を保証しているため、
    // 2つのcronリクエストが同時に同じユーザーへ挿入を試みても重複しないはず。
    const [res3, res4] = await Promise.all([
      fetch(`${baseUrl}/api/cron/growth-rollup`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }),
      fetch(`${baseUrl}/api/cron/growth-rollup`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }),
    ]);
    const [body3, body4] = await Promise.all([
      res3.json().catch((e) => ({ parseError: String(e) })),
      res4.json().catch((e) => ({ parseError: String(e) })),
    ]);
    if (res3.status === 200 && res4.status === 200) ok("並行実行した2つのcronリクエストが両方とも正常完了した");
    else bad(`並行実行のいずれかが失敗: status3=${res3.status} status4=${res4.status} body3=${JSON.stringify(body3)} body4=${JSON.stringify(body4)}`);

    const rowsAfterConcurrent = await fetchReturnEventRows(admin);
    const countsAfterConcurrent = countByUserEvent(rowsAfterConcurrent);
    let concurrentDup = false;
    for (const [key, count] of countsAfterConcurrent) {
      if (count > 1) { concurrentDup = true; bad(`${key}: 並行実行後に${count}件の重複行がある`); }
    }
    if (!concurrentDup) ok("並行実行後も(event_name,user_id)ペアの重複行は無い(DB側atomic insertが機能している)");
    if (rowsAfterConcurrent.length === rowsAfterRun2.length) {
      ok(`並行実行は新規発火対象が既にないため行数は変化しない(${rowsAfterRun2.length}件のまま)`);
    } else {
      bad(`並行実行後に行数が想定外に変化した (${rowsAfterRun2.length} -> ${rowsAfterConcurrent.length})`);
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(fail
    ? `\n=== test:growth-rollup-return-events: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:growth-rollup-return-events RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("growth-rollup-return-events crashed:", e);
  process.exit(1);
});
