/**
 * src/lib/analytics/trackServerEvent.ts の insertOncePerUserMilestoneEvent() 単体テスト。
 *
 * 実際のSupabase(service role)へ接続し、Postgres関数
 * insert_once_per_user_milestone_event()(部分ユニークインデックス
 * analytics_events_once_per_user_milestone_uniq 上のON CONFLICT DO NOTHING)を
 * 直接呼び出す形で検証する。
 *
 * このテストはinsertOncePerUserMilestoneEvent()自体を直接importせず、同じRPC呼び出しと
 * 同じstatus解釈ロジック(data===true→inserted / data===false→already_exists / error→failed)
 * をこのテストファイル内に複製している。理由: trackServerEvent.tsは`@/lib/supabase/admin`
 * (createAdminClient)をimportしており、Next.jsのパスエイリアス解決が無い素のNode ESM
 * importでは`ERR_MODULE_NOT_FOUND`になる(scripts/testing/e2e/lib配下のPlaywrightベース
 * テストはHTTP経由でこの問題を回避しているが、本テストはHTTPを介さずDB関数の挙動を
 * 直接検証したいため、同じ問題を避けられない)。src/lib/indexnow/submit.tsが同じ理由で
 * `@/lib/seo/siteUrl`のnormalizeSiteUrlをあえて複製している既存の前例に倣った。
 * ロジック自体はどちらもごく薄いラッパーのため、複製によるドリフトのリスクは小さい。
 *
 * 検証内容:
 *  1. 初回insertは{status:"inserted"}を返し、実際にanalytics_eventsへ1行保存される
 *  2. 同一(event_name,user_id)への2回目のinsertは{status:"already_exists"}を返し、
 *     行数は増えない(重複しない)
 *  3. サポート対象外のevent_nameを渡すとPostgres関数がraiseし、
 *     {status:"failed", error:...}が返る(insert失敗を成功扱いしない)
 *  4. 存在しないuser_id(FK制約違反)を渡した場合も同様に{status:"failed"}が返り、
 *     analytics_eventsに行が残らない(DB insert失敗を成功扱いする不具合の回帰ガード)
 *  5. Issue #95対応: 非production環境ではRPCを呼ばず、対象userIdがprofiles.is_test_account=true
 *     の場合に限りis_test_event=trueの直接INSERTへ切り替わる分岐
 *     (src/lib/analytics/trackServerEvent.tsのinsertOncePerUserMilestoneEvent)の検証。
 *     初回は{status:"inserted"}かつis_test_event=trueで保存され、2回目は
 *     一意制約違反(23505)を検知して{status:"already_exists"}を返すことを確認する。
 *     このステップ専用にreturn_day_7を事前削除してから実行するため、割り込み・過去の
 *     異常終了実行が残した行があっても正しくクリーンな状態から検証できる。
 *
 * 使い方: node scripts/testing/test-insert-once-per-user-milestone-event.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// src/lib/analytics/trackServerEvent.ts の insertOncePerUserMilestoneEvent() と
// 意図的に同一のstatus解釈ロジック(ファイル冒頭コメント参照)。
async function insertOncePerUserMilestoneEvent(admin, eventName, userId, properties = {}) {
  try {
    const { data, error } = await admin.rpc("insert_once_per_user_milestone_event", {
      p_event_name: eventName,
      p_user_id: userId,
      p_properties: properties,
    });
    if (error) return { status: "failed", error: error.message };
    return { status: data === true ? "inserted" : "already_exists" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

// 同じく src/lib/analytics/trackServerEvent.ts の非production分岐(RPCを使わず、
// 対象userIdがprofiles.is_test_account=trueの場合のみis_test_event=trueで直接INSERTし、
// 一意制約違反(23505)をalready_existsとして扱う。実ユーザー(is_test_account=false)の
// 場合は本番の一意性キーを予約しないよう何もINSERTせずalready_existsを返す)を
// 意図的に複製したもの(ファイル冒頭コメントと同じ理由でimportできないため)。
async function insertOncePerUserMilestoneEventNonProduction(admin, eventName, userId, properties = {}) {
  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_test_account")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) return { status: "failed", error: profileError.message };
    if (!profile?.is_test_account) return { status: "already_exists" };

    const { error } = await admin.from("analytics_events").insert({
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      user_id: userId,
      properties,
      schema_version: 1,
      device_category: "unknown",
      is_test_event: true,
    });
    if (error) {
      if (error.code === "23505") return { status: "already_exists" };
      return { status: "failed", error: error.message };
    }
    return { status: "inserted" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const admin = getAdminClient();

  // テスト対象user_id: 実在するprofilesのidを1件借用する(FK制約を満たすため)。
  const { data: testProfile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("is_test_account", true)
    .limit(1)
    .maybeSingle();
  if (profileErr || !testProfile) {
    console.error("テスト用profileが見つからない。is_test_account=trueのユーザーが最低1件必要です。");
    process.exit(1);
  }
  const userId = testProfile.id;

  // クリーンな状態からスタート
  await admin.from("analytics_events").delete().eq("user_id", userId).eq("event_name", "return_next_day");

  try {
    console.log("\n--- 1. 初回insertは inserted を返す ---");
    const first = await insertOncePerUserMilestoneEvent(admin, "return_next_day", userId, { test: true });
    if (first.status === "inserted") ok("初回insertは{status:'inserted'}を返す");
    else bad(`初回insertの結果が想定外: ${JSON.stringify(first)}`);

    const { data: rowsAfterFirst } = await admin
      .from("analytics_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "return_next_day");
    if ((rowsAfterFirst ?? []).length === 1) ok("実際にanalytics_eventsへ1行保存されている");
    else bad(`保存された行数が想定外: ${(rowsAfterFirst ?? []).length}件`);

    console.log("\n--- 2. 同一(event_name,user_id)への2回目は already_exists を返し重複しない ---");
    const second = await insertOncePerUserMilestoneEvent(admin, "return_next_day", userId, { test: true });
    if (second.status === "already_exists") ok("2回目のinsertは{status:'already_exists'}を返す");
    else bad(`2回目insertの結果が想定外: ${JSON.stringify(second)}`);

    const { data: rowsAfterSecond } = await admin
      .from("analytics_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "return_next_day");
    if ((rowsAfterSecond ?? []).length === 1) ok("2回目実行後も行数は1件のまま(重複していない)");
    else bad(`2回目実行後の行数が想定外: ${(rowsAfterSecond ?? []).length}件`);

    console.log("\n--- 3. サポート対象外のevent_nameはfailedを返す(insert失敗を成功扱いしない) ---");
    // TypeScript型としては受け付けない値だが、DB関数側のガード(RAISE EXCEPTION)を
    // 直接検証するため、意図的に型を迂回して呼び出す。
    const invalid = await insertOncePerUserMilestoneEvent(admin, "not_a_real_event", userId);
    if (invalid.status === "failed" && typeof invalid.error === "string") {
      ok("サポート対象外のevent_nameは{status:'failed', error: string}を返す");
    } else {
      bad(`想定外の結果: ${JSON.stringify(invalid)}`);
    }

    console.log("\n--- 4. 存在しないuser_id(FK制約違反)もfailedを返し、行が残らない ---");
    const fakeUserId = "00000000-0000-0000-0000-000000000000";
    const fkFail = await insertOncePerUserMilestoneEvent(admin, "return_day_7", fakeUserId);
    if (fkFail.status === "failed" && typeof fkFail.error === "string") {
      ok("FK制約違反時は{status:'failed', error: string}を返す(成功扱いしない)");
    } else {
      bad(`想定外の結果: ${JSON.stringify(fkFail)}`);
    }
    const { data: fkRows } = await admin
      .from("analytics_events")
      .select("id")
      .eq("user_id", fakeUserId)
      .eq("event_name", "return_day_7");
    if ((fkRows ?? []).length === 0) ok("FK制約違反時はanalytics_eventsに行が残らない");
    else bad(`想定外に行が残っている: ${(fkRows ?? []).length}件`);

    console.log("\n--- 5. 非production分岐: is_test_event=trueで直接INSERTし、重複は23505でalready_existsを返す ---");
    // testProfileはis_test_account=trueの共有フィクスチャ(limit 1で借用)であり、過去に
    // このテストが異常終了した場合や並行実行時に、return_day_7の行が既に残っている
    // 可能性がある。それを「2回目のinsertでは重複」と誤検知しないよう、Section 1同様に
    // このセクション専用の事前クリーンアップを行ってからクリーンな状態で検証する。
    await admin.from("analytics_events").delete().eq("user_id", userId).eq("event_name", "return_day_7");
    const npFirst = await insertOncePerUserMilestoneEventNonProduction(admin, "return_day_7", userId, { test: true });
    if (npFirst.status === "inserted") ok("非production分岐: 初回insertは{status:'inserted'}を返す");
    else bad(`非production分岐: 初回insertの結果が想定外: ${JSON.stringify(npFirst)}`);

    const { data: npRowsAfterFirst } = await admin
      .from("analytics_events")
      .select("id, is_test_event")
      .eq("user_id", userId)
      .eq("event_name", "return_day_7");
    if ((npRowsAfterFirst ?? []).length === 1 && npRowsAfterFirst[0].is_test_event === true) {
      ok("非production分岐: is_test_event=trueで1行だけ保存されている(本番集計から除外される)");
    } else {
      bad(`非production分岐: 保存内容が想定外: ${JSON.stringify(npRowsAfterFirst)}`);
    }

    const npSecond = await insertOncePerUserMilestoneEventNonProduction(admin, "return_day_7", userId, { test: true });
    if (npSecond.status === "already_exists") {
      ok("非production分岐: 2回目のinsertは一意制約違反(23505)を検知し{status:'already_exists'}を返す");
    } else {
      bad(`非production分岐: 2回目insertの結果が想定外: ${JSON.stringify(npSecond)}`);
    }
    const { data: npRowsAfterSecond } = await admin
      .from("analytics_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "return_day_7");
    if ((npRowsAfterSecond ?? []).length === 1) ok("非production分岐: 2回目実行後も行数は1件のまま(重複していない)");
    else bad(`非production分岐: 2回目実行後の行数が想定外: ${(npRowsAfterSecond ?? []).length}件`);
  } finally {
    // 後片付け(テストデータを残さない)
    await admin.from("analytics_events").delete().eq("user_id", userId).eq("event_name", "return_next_day");
    await admin.from("analytics_events").delete().eq("user_id", userId).eq("event_name", "return_day_7");
  }

  console.log(fail
    ? `\n=== test:insert-once-per-user-milestone-event: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:insert-once-per-user-milestone-event RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("test-insert-once-per-user-milestone-event crashed:", e);
  process.exit(1);
});
