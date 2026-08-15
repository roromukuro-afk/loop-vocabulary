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

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  console.log("=== 1. analytics_events 全体件数(is_test_event別) ===");
  const { count: totalCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }),
    "total count query",
  );
  const { count: falseCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }).eq("is_test_event", false),
    "is_test_event=false count query",
  );
  const { count: trueCount } = await unwrap(
    admin.from("analytics_events").select("*", { count: "exact", head: true }).eq("is_test_event", true),
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
    const { data: leakedRows } = await unwrap(
      admin
        .from("analytics_events")
        .select("event_name, user_id, occurred_at")
        .in("user_id", testAccountIds)
        .eq("is_test_event", false)
        .order("occurred_at", { ascending: false })
        .limit(1000),
      "test-account leaked rows query",
    );
    const byEvent = new Map();
    for (const r of leakedRows ?? []) byEvent.set(r.event_name, (byEvent.get(r.event_name) ?? 0) + 1);
    console.log(`is_test_account=trueユーザーが作った is_test_event=false 行(1000件上限取得): ${(leakedRows ?? []).length}件`);
    console.log("event_name別内訳:", Object.fromEntries(byEvent));
    const byUser = new Map();
    for (const r of leakedRows ?? []) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
    console.log("該当ユーザー数:", byUser.size);
    // メールアドレスと突き合わせ(test+の既知アカウントかどうか)
    const emailById = new Map((testAccounts ?? []).map((p) => [p.id, p.email]));
    for (const [uid, count] of [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${emailById.get(uid) ?? uid}: ${count}件`);
    }
  }

  console.log("\n=== 4. return_next_day / return_day_7 (once-per-user milestone) の is_test_event=false 行の詳細 ===");
  const { data: milestoneRows } = await unwrap(
    admin
      .from("analytics_events")
      .select("event_name, user_id, occurred_at")
      .in("event_name", ["return_next_day", "return_day_7"])
      .eq("is_test_event", false)
      .order("occurred_at", { ascending: false }),
    "milestone rows query",
  );
  console.log(`件数: ${(milestoneRows ?? []).length}`);
  for (const r of milestoneRows ?? []) {
    const { data: prof } = await unwrap(
      admin.from("profiles").select("email, is_test_account, created_at").eq("id", r.user_id).maybeSingle(),
      `profile lookup for user ${r.user_id}`,
    );
    console.log(`  ${r.event_name} | user=${r.user_id} (${prof?.email ?? "不明"}, is_test_account=${prof?.is_test_account}, signup=${prof?.created_at}) | occurred_at=${r.occurred_at}`);
  }

  console.log("\n=== 5. vocab_test_maker_* イベント(PR #92公開前からのProduction混入有無)の日別件数 ===");
  const { data: vtmRows } = await unwrap(
    admin
      .from("analytics_events")
      .select("event_name, occurred_at, is_test_event")
      .like("event_name", "vocab_test_maker_%")
      .order("occurred_at", { ascending: true })
      .limit(2000),
    "vocab_test_maker_* rows query",
  );
  const byDay = new Map();
  for (const r of vtmRows ?? []) {
    const day = r.occurred_at?.slice(0, 10);
    const key = `${day}|${r.is_test_event}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  console.log(`vocab_test_maker_* 総件数(2000件上限取得): ${(vtmRows ?? []).length}`);
  console.log("日別 x is_test_event別件数:");
  for (const [key, count] of [...byDay.entries()].sort()) console.log(`  ${key}: ${count}件`);

  console.log("\n=== 6. event_name別 is_test_event=false 件数トップ20(全体像) ===");
  // PostgREST(Supabase)のデフォルト応答上限(通常1000行)は.limit()に大きい値を
  // 渡しても超えられない。.limit(50000)は実際には最初の約1000行しか返さず、
  // 「全体像」を謳いながら黙って取りこぼす(Codexレビュー指摘対応)。
  // acquisition-snapshot.mjsのfetchEventsInWindow()と同じ.range()ページングで、
  // falseCount件すべてを確実に取得する。.order()を指定しないとページ間で行の並び順が
  // 安定せず、ページを跨ぐ間の新規挿入等でoffsetの意味がずれ取りこぼし/二重カウントが
  // 起き得るため、idを一意な決定的順序として明示する(Codexレビュー指摘対応、
  // acquisition-snapshot.mjs側の同型の指摘を受けてこちらも同様に修正)。
  const allFalseRows = [];
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: page } = await unwrap(
        admin
          .from("analytics_events")
          .select("id, event_name")
          .eq("is_test_event", false)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1),
        `all is_test_event=false rows query (page from=${from})`,
      );
      if (!page || page.length === 0) break;
      allFalseRows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  const eventCounts = new Map();
  for (const r of allFalseRows) eventCounts.set(r.event_name, (eventCounts.get(r.event_name) ?? 0) + 1);
  console.log(`(${allFalseRows.length}件を全ページング取得。falseCount=${falseCount})`);
  if (allFalseRows.length !== falseCount) {
    console.error(`❌ ページング取得件数(${allFalseRows.length})がfalseCount(${falseCount})と一致しない(取りこぼしの可能性)`);
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
