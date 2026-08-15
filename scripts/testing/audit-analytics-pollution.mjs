/**
 * Issue #95: analytics_events の過去汚染範囲を特定するための read-only 監査スクリプト。
 * DELETE/UPDATEは一切行わない(調査結果を出力するのみ)。
 *
 * 使い方: node scripts/testing/audit-analytics-pollution.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

// クエリのerrorを握りつぶさない。1件でも失敗したら「クリーンに見える」不完全な
// レポートを出さず、即座に例外で監査全体を中断する(Codexレビュー指摘対応)。
async function unwrap(queryPromise, label) {
  const result = await queryPromise;
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`);
  return result;
}

// offsetベースの.range()ページングは、.order()を追加してもページを跨ぐ間の新規挿入/削除で
// offsetの意味がずれ取りこぼし/二重カウントが起き得る(Codexレビュー指摘対応、前回の
// order追加だけでは不十分との再指摘)。一意なid(UUID)を昇順のkeysetカーソルとして使う
// 方式に切り替えたが、analytics_events.idはgen_random_uuid()(挿入順と無相関のランダム値)
// のため、cursorより小さいidを持つ行がページング中に新規挿入されると、その行はどのページにも
// 現れず永久に取りこぼされ得る(Codexレビュー指摘対応、再度の指摘)。DBがINSERT時に自動設定する
// created_at(occurred_atと違いクライアントが指定できない)を使い、呼び出し時点のasOf以前に
// 作られた行だけへ読み取り対象を凍結する。凍結後の集合は走査中に増減しないため、
// その中でのid順ページングは(idが挿入順と無相関でも)安全に機能する。
// queryFactoryはid昇順の.order()・created_at上限未適用のPostgrestFilterBuilderを返す関数。
async function fetchAllPages(queryFactory, label, asOf) {
  const pageSize = 1000;
  const rows = [];
  let cursorId = null;
  for (;;) {
    let query = queryFactory().lte("created_at", asOf).order("id", { ascending: true }).limit(pageSize);
    if (cursorId) query = query.gt("id", cursorId);
    const { data } = await unwrap(query, `${label} (cursorId=${cursorId})`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    cursorId = data[data.length - 1].id;
  }
  return rows;
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  // このスクリプト全体で「asOf時点のスナップショット」として一貫させる(fetchAllPages内の
  // コメント参照)。Section 1のcountクエリにも同じ上限を適用しないと、Section 6での
  // 「ページング取得件数 === falseCount」比較が、count取得後に新規挿入された行の分だけ
  // 食い違って誤検知する。
  const asOf = new Date().toISOString();

  console.log("=== 1. analytics_events 全体件数(is_test_event別、asOf時点) ===");
  const { count: totalCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }).lte("created_at", asOf),
    "total count query",
  );
  const { count: falseCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }).eq("is_test_event", false).lte("created_at", asOf),
    "is_test_event=false count query",
  );
  const { count: trueCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }).eq("is_test_event", true).lte("created_at", asOf),
    "is_test_event=true count query",
  );
  console.log(`total=${totalCount}, is_test_event=false: ${falseCount}, is_test_event=true: ${trueCount}`);

  console.log("\n=== 2. is_test_event=false のうち、最古行の occurred_at (列自体の追加日=018マイグレーション以前は全行false) ===");
  const { data: oldestFalse } = await unwrap(
    admin
      .from("analytics_events")
      .select("occurred_at, event_name")
      .eq("is_test_event", false)
      .order("occurred_at", { ascending: true })
      .limit(1),
    "oldest is_test_event=false row query",
  );
  console.log("oldest is_test_event=false row:", oldestFalse?.[0]);

  console.log("\n=== 3. is_test_account=true のユーザーが作った行のうち、is_test_event=false になっているものの件数(event_name別) ===");
  const { data: testAccounts } = await unwrap(
    admin.from("profiles").select("id, email").eq("is_test_account", true),
    "test accounts query",
  );
  const testAccountIds = (testAccounts ?? []).map((p) => p.id);
  console.log(`is_test_account=true のユーザー数: ${testAccountIds.length}`);
  if (testAccountIds.length > 0) {
    // .limit(1000)はPostgRESTの応答上限そのものであり、is_test_accountユーザーの混入が
    // 1000件を超えると黙って新しいページ分を取りこぼし、event_name別内訳・該当ユーザー数・
    // ランキングが「全体像」ではなく最新1000件だけの偏った集計になる(Codexレビュー指摘対応)。
    // fetchAllPages()のkeysetページング(idキー・asOfスナップショット凍結)で全件確実に取得する。
    const leakedRows = await fetchAllPages(
      () =>
        admin
          .from("analytics_events")
          .select("id, event_name, user_id, occurred_at")
          .in("user_id", testAccountIds)
          .eq("is_test_event", false),
      "test-account leaked rows query",
      asOf,
    );
    const byEvent = new Map();
    for (const r of leakedRows) byEvent.set(r.event_name, (byEvent.get(r.event_name) ?? 0) + 1);
    console.log(`is_test_account=trueユーザーが作った is_test_event=false 行(全ページング取得): ${leakedRows.length}件`);
    console.log("event_name別内訳:", Object.fromEntries(byEvent));
    const byUser = new Map();
    for (const r of leakedRows) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
    console.log("該当ユーザー数:", byUser.size);
    // メールアドレスと突き合わせ(test+の既知アカウントかどうか)
    const emailById = new Map((testAccounts ?? []).map((p) => [p.id, p.email]));
    for (const [uid, count] of [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${emailById.get(uid) ?? uid}: ${count}件`);
    }
  }

  console.log("\n=== 4. return_next_day / return_day_7 (once-per-user milestone) の is_test_event=false 行の詳細 ===");
  // このsectionは監査対象そのもの(本番の一意性キーを汚染しているかもしれない行)を
  // 1件残らず洗い出すことが目的のため、Sections 5・6と同じくPostgRESTの応答上限で
  // 黙って取りこぼしてはならない。fetchAllPages()でページングし、表示用にJS側で
  // occurred_at降順へ並べ替える(Codexレビュー指摘対応)。
  const milestoneRows = (
    await fetchAllPages(
      () =>
        admin
          .from("analytics_events")
          .select("id, event_name, user_id, occurred_at")
          .in("event_name", ["return_next_day", "return_day_7"])
          .eq("is_test_event", false),
      "milestone rows query",
      asOf,
    )
  ).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));
  console.log(`件数: ${milestoneRows.length}`);
  for (const r of milestoneRows) {
    const { data: prof } = await unwrap(
      admin.from("profiles").select("email, is_test_account, created_at").eq("id", r.user_id).maybeSingle(),
      `profile lookup for user ${r.user_id}`,
    );
    console.log(`  ${r.event_name} | user=${r.user_id} (${prof?.email ?? "不明"}, is_test_account=${prof?.is_test_account}, signup=${prof?.created_at}) | occurred_at=${r.occurred_at}`);
  }

  console.log("\n=== 5. vocab_test_maker_* イベント(PR #92公開前からのProduction混入有無)の日別件数 ===");
  // .limit(2000)はPostgRESTのデフォルト応答上限(通常1000行)を超えられず、実際には
  // 最初の約1000行しか返さない(Codexレビュー指摘対応: Section 6と同型の取りこぼし)。
  // fetchAllPages()のkeysetページングで全件確実に取得する。
  const vtmRows = await fetchAllPages(
    () => admin.from("analytics_events").select("id, event_name, occurred_at, is_test_event").like("event_name", "vocab_test_maker_%"),
    "vocab_test_maker_* rows query",
    asOf,
  );
  const byDay = new Map();
  for (const r of vtmRows) {
    const day = r.occurred_at?.slice(0, 10);
    const key = `${day}|${r.is_test_event}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  console.log(`vocab_test_maker_* 総件数(全ページング取得): ${vtmRows.length}`);
  console.log("日別 x is_test_event別件数:");
  for (const [key, count] of [...byDay.entries()].sort()) console.log(`  ${key}: ${count}件`);

  console.log("\n=== 6. event_name別 is_test_event=false 件数トップ20(全体像) ===");
  // PostgREST(Supabase)のデフォルト応答上限(通常1000行)は.limit()に大きい値を
  // 渡しても超えられない。.limit(50000)は実際には最初の約1000行しか返さず、
  // 「全体像」を謳いながら黙って取りこぼす(Codexレビュー指摘対応)。fetchAllPages()の
  // keysetページングで全件確実に取得する。
  const allFalseRows = await fetchAllPages(
    () => admin.from("analytics_events").select("id, event_name").eq("is_test_event", false),
    "all is_test_event=false rows query",
    asOf,
  );
  const eventCounts = new Map();
  for (const r of allFalseRows) eventCounts.set(r.event_name, (eventCounts.get(r.event_name) ?? 0) + 1);
  console.log(`(${allFalseRows.length}件を全ページング取得。falseCount=${falseCount})`);
  if (allFalseRows.length !== falseCount) {
    // 件数不一致は「監査結果が不完全/矛盾している」ことを意味するため、警告ログだけで
    // 済ませず監査自体を失敗させる(Codexレビュー指摘対応: 自動化が不正な監査結果を
    // 正常終了として受理してしまわないように)。
    throw new Error(
      `ページング取得件数(${allFalseRows.length})がfalseCount(${falseCount})と一致しない(取りこぼし/監査中の増減の可能性)`,
    );
  }
  for (const [name, count] of [...eventCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${name}: ${count}件`);
  }

  console.log("\n=== 監査完了(read-only、DELETE/UPDATEは実行していません) ===");
}

main().catch((e) => {
  console.error("audit-analytics-pollution crashed:", e);
  process.exit(1);
});
