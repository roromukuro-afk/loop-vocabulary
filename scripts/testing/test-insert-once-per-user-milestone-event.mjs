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
 * 【テスト対象ユーザー: 使い捨て専用アカウント】
 * 以前はis_test_account=trueの既存共有プロフィールを`limit(1)`で借用していたが、
 * 2つのテスト実行(別プロセス・別マシン含む)が同じプロフィールを同時に選ぶと、
 * 「退避→削除→挿入→片付け→復元」の非トランザクション的な手順が競合し、
 * 一方の実行が他方の実行の復元処理を巻き込んで壊してしまう(Codexレビュー指摘対応:
 * 退避/復元の手順自体をいくら堅牢にしても、共有リソースを複数実行が同時に
 * 触る限り根本的には解決しない)。そのため、scripts/testing/e2e/ai-usage-retention.mjs
 * の既存パターン(admin.auth.admin.createUser()で使い捨てauthユーザーを作り、
 * finallyでadmin.auth.admin.deleteUser()する)にならい、このテスト実行専用の
 * 使い捨てユーザーを毎回新規作成する。他のテスト実行や既存の共有テストアカウントの
 * データには一切触れないため、複数プロセスを同時実行しても構造的に競合し得ない。
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
 *
 * 並行実行の回帰確認は scripts/testing/test-milestone-fixture-concurrency.mjs 参照。
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

  // このテスト実行専用の使い捨てユーザーを作成する(ファイル冒頭コメント参照)。
  // profilesへの行はauth.usersへのINSERTをトリガーとした既存の仕組みで自動作成される
  // 前提(ai-usage-retention.mjsの既存パターンと同じ)。
  const tempEmail = `test+milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@loop-vocabulary.app`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: tempEmail,
    password: `Milestone-${Date.now()}-${Math.random().toString(36).slice(2, 10)}!`,
    email_confirm: true,
    user_metadata: { is_test_account: true, purpose: "insertOncePerUserMilestoneEvent() 使い捨てテスト" },
  });
  if (createErr || !created?.user) {
    console.error("使い捨てテストユーザーの作成に失敗:", createErr?.message);
    process.exit(1);
  }
  const userId = created.user.id;

  // .update()は対象行が無くてもerrorにならず(0件更新のまま成功扱いになる)、
  // profilesへのトリガーがまだ反映されていないケースを見逃してしまうため、
  // .select()で実際に更新できた行を確認する。
  const { data: updatedProfile, error: markTestErr } = await admin
    .from("profiles")
    .update({ is_test_account: true })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (markTestErr || !updatedProfile) {
    console.error(
      "使い捨てテストユーザーのis_test_account設定に失敗:",
      markTestErr?.message ?? "profiles行が見つからない(auth.users→profilesのtriggerが未反映の可能性)",
    );
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    process.exit(1);
  }

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
    // userIdはこのテスト専用の使い捨てユーザーであり、他のどの実行とも共有されないため、
    // return_day_7を事前クリーンアップする必要が無い(常に未使用の状態から始まる)。
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
    // 後片付け: このテスト専用の使い捨てユーザーが作ったanalytics_events行を削除してから、
    // authユーザー自体を削除する。analytics_events.user_idはON DELETE SET NULL
    // (017_growth_os_foundation.sql)のため、authユーザー削除だけではanalytics_events行は
    // 残存しuser_id=NULLになるだけで消えない。そのため明示的に先に行を削除する必要がある。
    // cleanup自体が失敗した場合、使い捨てユーザーや残留行が残ってしまうため、
    // console.errorだけで済ませずテスト失敗として記録する。
    const { error: deleteEventsErr } = await admin.from("analytics_events").delete().eq("user_id", userId);
    if (deleteEventsErr) {
      bad(`使い捨てユーザーのanalytics_events削除に失敗しました。手動確認が必要です(user_id=${userId}): ${deleteEventsErr.message}`);
    }
    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      bad(`使い捨てユーザーの削除に失敗しました。手動確認が必要です(user_id=${userId}, email=${tempEmail}): ${deleteUserErr.message}`);
    }
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
