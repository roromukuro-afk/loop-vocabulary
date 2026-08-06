/**
 * Issue #80: src/app/api/cron/weekly-digest/route.ts のクエリ失敗ハンドリング検証。
 *
 * ## なぜソースコード確認方式なのか(実HTTP呼び出しをしない理由)
 * このcronは「notify_weekly_email=trueの全ユーザー(最大500件)」を対象に
 * 実メールを送信する設計であり、単一のテスト専用fixtureへスコープを絞る
 * 仕組みが存在しない。そのため、実DBに対して実際にHTTPでこのルートを
 * 呼び出す形の検証は、環境にRESEND_API_KEYが設定されていて
 * notify_weekly_email=trueの実ユーザーが1人でも存在すれば、本テストが
 * 実行されるたびに本物のメールが送信されてしまう危険がある
 * (scripts/testing/e2e/stripe-premium-webhook.mjsが同種の理由で
 * webhookの実メール送信分岐をソースコード確認に留めているのと同じ設計判断)。
 *
 * また、Playwrightのpage.route()はブラウザ発のrequestしか横取りできず、
 * このルート内部のSupabase呼び出し(サーバー側)をテストプロセスから
 * モックする手段も無い。
 *
 * そのため本テストは、実行のたびに結果が変わり得る実DB状態
 * (migration適用有無・実ユーザーの通知設定値)に依存せず、常に同じ結果を
 * 返す決定論的な検証として、ソースコードの構造を直接確認する方式を取る。
 * Resendへの実送信・実DBへのクエリはいずれも一切発生しない。
 *
 * 使い方: node scripts/testing/test-weekly-digest-error-handling.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(__dirname, "../../src/app/api/cron/weekly-digest/route.ts");

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  const source = readFileSync(ROUTE_PATH, "utf8");

  // --- 1. profiles queryのerrorを検査し、500 + profiles_fetch_failedを返すこと ---
  const profilesBlockMatch = source.match(
    /\.from\("profiles"\)[\s\S]*?\.limit\(500\);\s*\n\s*if\s*\(profilesError\)\s*\{\s*\n\s*return NextResponse\.json\(\{ error: "profiles_fetch_failed" \}, \{ status: 500 \}\);/,
  );
  if (profilesBlockMatch) ok("profiles query失敗時に500 + profiles_fetch_failedを返す構造がある");
  else bad("profiles query失敗時のerrorチェック+500応答が見つからない");

  // --- 2. sent:0を成功として黙って返していないこと(profilesError発生時は
  //         その時点でreturnしており、後段のsent:0成功パスへ到達しない) ---
  const emptyProfilesReturnsSentZero = /if\s*\(!profiles\?\.length\)\s*return NextResponse\.json\(\{ sent: 0, failed: 0 \}\);/.test(source);
  if (emptyProfilesReturnsSentZero) {
    ok("対象ユーザーが0件の場合(query自体は成功)はsent:0・failed:0を明示的に返す(query失敗時のprofiles_fetch_failedとは経路が分離されている)");
  } else {
    bad("対象ユーザー0件時の分岐が想定した形になっていない");
  }

  // --- 3. daily_stats(weekStats)クエリの失敗検査 ---
  const weekStatsCheck = /error:\s*weekStatsError[\s\S]{0,20}\}\s*=\s*await admin[\s\S]*?if\s*\(weekStatsError\)\s*\{\s*\n\s*return NextResponse\.json\(\{ error: "daily_stats_fetch_failed" \}, \{ status: 500 \}\);/.test(source)
    || /const\s*\{\s*data:\s*weekStats,\s*error:\s*weekStatsError\s*\}/.test(source) && /if\s*\(weekStatsError\)\s*\{\s*\n\s*return NextResponse\.json\(\{ error: "daily_stats_fetch_failed" \}, \{ status: 500 \}\);/.test(source);
  if (weekStatsCheck) ok("daily_stats(週間統計)query失敗時に500 + daily_stats_fetch_failedを返す構造がある");
  else bad("daily_stats(週間統計)query失敗時のerrorチェックが見つからない");

  // --- 4. words(dueWords)クエリの失敗検査 ---
  const dueWordsCheck = /const\s*\{\s*data:\s*dueWords,\s*error:\s*dueWordsError\s*\}/.test(source)
    && /if\s*\(dueWordsError\)\s*\{\s*\n\s*return NextResponse\.json\(\{ error: "words_fetch_failed" \}, \{ status: 500 \}\);/.test(source);
  if (dueWordsCheck) ok("words(復習待ち)query失敗時に500 + words_fetch_failedを返す構造がある");
  else bad("words(復習待ち)query失敗時のerrorチェックが見つからない");

  // --- 5. daily_stats(recentActivity)クエリの失敗検査 ---
  const recentActivityCheck = /const\s*\{\s*data:\s*recentActivity,\s*error:\s*recentActivityError\s*\}/.test(source)
    && /if\s*\(recentActivityError\)\s*\{\s*\n\s*return NextResponse\.json\(\{ error: "recent_activity_fetch_failed" \}, \{ status: 500 \}\);/.test(source);
  if (recentActivityCheck) ok("daily_stats(ストリーク)query失敗時に500 + recent_activity_fetch_failedを返す構造がある");
  else bad("daily_stats(ストリーク)query失敗時のerrorチェックが見つからない");

  // --- 6. いずれの失敗チェックも、実際のメール送信ループ(getResend().emails.send)より前に配置されていること ---
  const sendCallIndex = source.indexOf("getResend().emails.send");
  const profilesCheckIndex = source.indexOf('error: "profiles_fetch_failed"');
  const weekStatsCheckIndex = source.indexOf('error: "daily_stats_fetch_failed"');
  const dueWordsCheckIndex = source.indexOf('error: "words_fetch_failed"');
  const recentActivityCheckIndex = source.indexOf('error: "recent_activity_fetch_failed"');
  if (
    sendCallIndex > 0
    && profilesCheckIndex > 0 && profilesCheckIndex < sendCallIndex
    && weekStatsCheckIndex > 0 && weekStatsCheckIndex < sendCallIndex
    && dueWordsCheckIndex > 0 && dueWordsCheckIndex < sendCallIndex
    && recentActivityCheckIndex > 0 && recentActivityCheckIndex < sendCallIndex
  ) {
    ok("4件のquery失敗チェックはすべて、実際のメール送信呼び出し(getResend().emails.send)より前のコード位置にあり、いずれかが失敗すれば送信ループへ到達しない");
  } else {
    bad("query失敗チェックとメール送信呼び出しの位置関係が想定と異なる(送信ループへ到達してしまう可能性がある)");
  }

  // --- 7. 成功時にsent/failedの両方を件数で報告すること ---
  const finalReturnMatch = source.match(/return NextResponse\.json\(\{ sent, failed \}\);/);
  if (finalReturnMatch) ok("最終応答はsent/failed両方の件数を報告する({sent, failed}形式)");
  else bad("最終応答がsent/failed件数形式になっていない");

  // --- 8. emailが取得できなかったユーザーもfailedとして計上されること ---
  const noEmailCountsAsFailed = /if\s*\(!email\)\s*\{\s*failed\+\+;\s*continue;\s*\}/.test(source);
  if (noEmailCountsAsFailed) ok("メールアドレスが取得できなかったユーザーもfailed件数へ計上される(黙ってスキップしない)");
  else bad("メールアドレス未取得ユーザーの扱いが想定と異なる");

  // --- 9. Resend送信失敗もfailedへ計上されること ---
  const sendFailureCountsAsFailed = /catch\s*\{\s*\n\s*\/\/[^\n]*\n\s*failed\+\+;\s*\n\s*\}/.test(source);
  if (sendFailureCountsAsFailed) ok("Resend送信自体の失敗もfailed件数へ計上される(黙って握りつぶさない)");
  else bad("Resend送信失敗時のfailed計上が見つからない");

  // --- 10. 個別メールアドレスをレスポンス・ログへ出力していないこと ---
  const hasConsoleWithEmail = /console\.(log|error|warn)\([^)]*\bemail\b[^)]*\)/.test(source);
  if (!hasConsoleWithEmail) ok("console.log/error/warnの引数にemail変数を直接含む箇所が無い(個別メールアドレスをログへ出していない)");
  else bad("console出力にemail変数が含まれている可能性がある(個別メールアドレスの漏洩リスク)");

  const jsonResponsesWithEmail = [...source.matchAll(/NextResponse\.json\(([^)]*)\)/g)].some((m) => /\bemail\b/.test(m[1]));
  if (!jsonResponsesWithEmail) ok("NextResponse.json()のレスポンスに個別メールアドレスを含む箇所が無い");
  else bad("レスポンスに個別メールアドレスが含まれている可能性がある");

  console.log(`\n=== test:weekly-digest-error-handling RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
