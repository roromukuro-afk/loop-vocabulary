/**
 * Loop Autonomous Improvement System: dedup_keyによる重複排除の検証。
 * improvement_issues.dedup_key にUNIQUE制約があるため、同じdedup_keyでの2回目のINSERTは
 * 必ず失敗する(upsertIssue.tsはこれを利用してINSERT/UPDATEを使い分けている)。
 *
 * 使い方: node scripts/testing/test-issue-deduplication.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const admin = getAdminClient();
  const dedupKey = `test:issue_deduplication:${Date.now()}`;
  let firstId = null;

  try {
    const { data: first, error: firstErr } = await admin
      .from("improvement_issues")
      .insert({
        category: "engineering",
        title: "重複排除テスト用issue(1回目)",
        problem: "テスト用",
        severity: "low",
        confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
        source: "test_script",
        dedup_key: dedupKey,
        autonomy_level: 2,
      })
      .select("id")
      .single();
    if (firstErr) throw new Error(`1回目のINSERTが失敗した(想定外): ${firstErr.message}`);
    firstId = first.id;
    ok("同じdedup_keyでの1回目のINSERTは成功する");

    const { error: secondErr } = await admin.from("improvement_issues").insert({
      category: "engineering",
      title: "重複排除テスト用issue(2回目、同じdedup_key)",
      problem: "テスト用(2回目)",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: dedupKey,
      autonomy_level: 2,
    });
    if (secondErr && /duplicate key|unique constraint/i.test(secondErr.message)) {
      ok(`同じdedup_keyでの2回目のINSERTはUNIQUE制約違反で拒否される (${secondErr.message.slice(0, 80)})`);
    } else if (secondErr) {
      fail(`2回目のINSERTが失敗したが理由がUNIQUE制約違反ではない: ${secondErr.message}`);
    } else {
      fail("同じdedup_keyで2回目のINSERTが成功してしまった(重複排除が機能していない)");
    }

    // upsertIssue.ts相当の挙動: 既存行があればUPDATEで対応する(新規行を作らない)
    const { error: updateErr } = await admin
      .from("improvement_issues")
      .update({ problem: "テスト用(UPDATE経由での更新)" })
      .eq("dedup_key", dedupKey);
    if (updateErr) fail(`既存行のUPDATEが失敗した: ${updateErr.message}`);
    else ok("既存行はUPDATEで更新できる(upsertIssue.tsが採用する重複排除パターン)");

    const { data: countCheck } = await admin.from("improvement_issues").select("id").eq("dedup_key", dedupKey);
    if (countCheck?.length === 1) ok("最終的にdedup_key1件につき行は1件のみ存在する");
    else fail(`dedup_key当たりの行数が想定外: ${countCheck?.length}件`);
  } finally {
    if (firstId) {
      await admin.from("improvement_issues").delete().eq("id", firstId);
      console.log("(cleanup) テスト用issueを削除した");
    }
  }

  console.log(failed ? `\n=== test:issue-deduplication: ${failed}件失敗 ===` : "\n=== test:issue-deduplication RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-issue-deduplication crashed:", e);
  process.exit(1);
});
