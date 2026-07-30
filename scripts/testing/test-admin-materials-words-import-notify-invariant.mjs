/**
 * src/app/api/admin/materials/[id]/words/route.ts のIndexNow通知呼び出しに関する
 * ソース構造不変条件テスト(ネットワーク・サーバー起動不要)。
 *
 * chatgpt-codex-connectorのP2レビュー指摘(公開教材への単語追加が通知されない問題)
 * への対応で、このルートに以下の2つの不変条件を導入した。この2つは
 * test-admin-materials-words-import-api.mjs(実サーバー・実DB)では直接検証しづらい
 * (何百語インポートしても実際に外部送信が1回だけかを、実際のIndexNow API呼び出し
 * なしに黒箱的に確認する手段が無い)ため、ソースの並び順を直接検証することで保証する:
 *
 *  1. notifyIndexNowAfterResponse()の呼び出しは、単語insertのforループの外(後)に
 *     一度だけ存在する(ループ内には存在しない) → 何語インポートしても通知は最大1回
 *  2. その呼び出しは `inserted > 0` の判定より後にある → 1件も挿入されなければ
 *     (=全チャンク失敗などのDB失敗時)通知条件そのものに到達しない
 *
 * 使い方: node scripts/testing/test-admin-materials-words-import-notify-invariant.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(__dir, "../../src/app/api/admin/materials/[id]/words/route.ts");

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  const src = readFileSync(ROUTE_PATH, "utf8");

  const loopStart = src.indexOf("for (let i = 0; i < payload.length; i += CHUNK_SIZE)");
  const loopEnd = src.indexOf("}", src.indexOf("inserted += slice.length;"));
  const insertedCheck = src.indexOf("if (inserted > 0 && isEffectivelyPublicMaterial(material))");
  const notifyCall = src.indexOf("notifyIndexNowAfterResponse(");

  if ([loopStart, loopEnd, insertedCheck, notifyCall].some((i) => i === -1)) {
    fail("想定していたソースパターン(forループ・inserted判定・notify呼び出し)のいずれかが見つからない(ファイル構造が変わった可能性)");
    console.log(`\n=== test:admin-materials-words-import-notify-invariant: ${failed}件失敗 ===`);
    process.exit(1);
  }

  // notifyIndexNowAfterResponseの呼び出しがソース全体に1回しか出現しないこと
  const occurrences = src.split("notifyIndexNowAfterResponse(").length - 1;
  if (occurrences === 1) {
    ok("notifyIndexNowAfterResponse()の呼び出しはソース中に1回のみ存在する(何語インポートしても通知は最大1回)");
  } else {
    fail(`notifyIndexNowAfterResponse()の呼び出しが${occurrences}回存在する(ループ内で複数回呼ばれている可能性)`);
  }

  if (notifyCall > loopEnd) {
    ok("notify呼び出しはinsertのforループの外(後)にある(ループ内で毎回呼ばれない)");
  } else {
    fail("notify呼び出しがforループの内側にある可能性(単語ごとに個別送信してしまう)");
  }

  if (notifyCall > insertedCheck && insertedCheck < loopEnd) {
    fail("`inserted > 0`判定の位置がループより前にある(ループ完了前の値で判定している可能性)");
  } else if (notifyCall > insertedCheck) {
    ok("notify呼び出しは`inserted > 0 && isEffectivelyPublicMaterial(material)`の判定より後にある(1件も挿入されなければ通知条件に到達しない)");
  } else {
    fail("notify呼び出しが`inserted > 0`判定より前にある(挿入結果を見ずに通知してしまう可能性)");
  }

  console.log(failed ? `\n=== test:admin-materials-words-import-notify-invariant: ${failed}件失敗 ===` : "\n=== test:admin-materials-words-import-notify-invariant RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
