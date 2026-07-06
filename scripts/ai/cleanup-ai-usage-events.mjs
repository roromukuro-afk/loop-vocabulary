/**
 * ai_usage_events の保持期間ポリシー(既定90日)を超えた行の削除（既定dry-run）。
 *
 * 2026-07-06、AI利用状況の運用監視で新設したai_usage_eventsは放置すると
 * 増え続けるため、保持期間を過ぎた行を安全に削除できる手動実行用スクリプトを用意した。
 *
 * ai_usage_eventsはメタデータのみ（AIへの入力本文・prompt・Claudeの生レスポンスは
 * そもそも保存していない）ため、reports/配下へのバックアップ・ロールバックSQLは
 * 生成しない（scripts/materials/deduplicate-material-words.mjs等とは異なり、
 * 復元価値のあるコンテンツを削除するわけではなく、継続的に新規発生する運用ログの
 * 定期整理であるため）。test account / real accountの区別も行わない
 * （保持期間ポリシーはアカウント種別に関係なく一律に適用する）。
 *
 * 使い方:
 *   node scripts/ai/cleanup-ai-usage-events.mjs                    # dry-run（既定・DB変更なし）
 *   node scripts/ai/cleanup-ai-usage-events.mjs --apply            # 実削除
 *     実削除には環境変数 CONFIRM_AI_USAGE_CLEANUP=yes の明示指定が必須（誤操作防止の二重ガード）。
 *   node scripts/ai/cleanup-ai-usage-events.mjs --retention-days=60  # 保持日数を一時的に変更（既定90日）
 *
 * npm scripts:
 *   npm run cleanup:ai-usage-events        -> 上記dry-run
 *   npm run cleanup:ai-usage-events:apply  -> --apply付き（CONFIRM_AI_USAGE_CLEANUP=yesと併用が必須）
 */
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, requireEnv } from "../testing/lib/env.mjs";

// PRODUCTION_MONITORING.md §13-7で運用方針として文書化している既定保持期間。
// 変更する場合はこの定数とドキュメントの両方を更新すること。
export const DEFAULT_RETENTION_DAYS = 90;

const APPLY = process.argv.includes("--apply");
const retentionArg = process.argv.find((a) => a.startsWith("--retention-days="));
const RETENTION_DAYS = retentionArg
  ? Number(retentionArg.split("=")[1])
  : DEFAULT_RETENTION_DAYS;

export function cutoffIsoFor(retentionDays, now = new Date()) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

async function run() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    console.error(`❌ retention-daysが不正です: ${retentionArg}`);
    process.exit(1);
  }

  const cutoffIso = cutoffIsoFor(RETENTION_DAYS);

  console.log(APPLY ? "=== ai_usage_events 保持期間超過分の削除 (apply モード) ===" : "=== ai_usage_events 保持期間超過分の削除計画 (dry-run) ===");
  console.log(`保持期間: ${RETENTION_DAYS}日（カットオフ日時: ${cutoffIso} より前を削除対象とする）`);

  const [{ count: totalCount }, { count: staleCount }] = await Promise.all([
    admin.from("ai_usage_events").select("*", { count: "exact", head: true }),
    admin.from("ai_usage_events").select("*", { count: "exact", head: true }).lt("created_at", cutoffIso),
  ]);

  const total = totalCount ?? 0;
  const stale = staleCount ?? 0;
  const remaining = total - stale;

  console.log(`\n現在の総行数: ${total.toLocaleString()}件`);
  console.log(`削除対象（${cutoffIso} より前）: ${stale.toLocaleString()}件`);
  console.log(`保持継続（${cutoffIso} 以降）: ${remaining.toLocaleString()}件`);

  if (stale === 0) {
    console.log("\n削除対象の行はありません。");
    return;
  }

  if (!APPLY) {
    console.log("\ndry-runモードのため、DBへの削除は実行していません。");
    console.log(`実削除する場合: npm run cleanup:ai-usage-events:apply （CONFIRM_AI_USAGE_CLEANUP=yes と併用が必要）`);
    return;
  }

  if (process.env.CONFIRM_AI_USAGE_CLEANUP !== "yes") {
    console.error(
      "❌ 実削除には環境変数 CONFIRM_AI_USAGE_CLEANUP=yes の明示指定が必要です。" +
        "誤操作防止のための二重ガードです。ユーザーの承認を得てから実行してください。",
    );
    process.exit(1);
  }

  console.log(`\n削除対象 ${stale.toLocaleString()}件を削除します...`);
  // ai_usage_eventsは現状の規模(数千件オーダー)であれば単一のDELETEで十分安全。
  // 将来テーブルが大規模化した場合は、created_atの範囲を区切った複数回実行に分割すること。
  const { error, count: deletedCount } = await admin
    .from("ai_usage_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);

  if (error) {
    console.error(`❌ 削除失敗: ${error.message}`);
    process.exit(1);
  }
  console.log(`削除完了: ${(deletedCount ?? 0).toLocaleString()}件削除`);

  const { count: afterCount } = await admin.from("ai_usage_events").select("*", { count: "exact", head: true });
  console.log(`削除後の総行数: ${(afterCount ?? 0).toLocaleString()}件`);
}

run().catch((e) => {
  console.error("cleanup-ai-usage-events failed:", e);
  process.exit(1);
});
